import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import {
  GetWalletParams,
  TopUpWalletParams,
  TopUpWalletBody,
  GetTransactionsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const OPTIMA_KEY    = process.env["OPTIMA_API_KEY"]    ?? "";
const OPTIMA_SECRET = process.env["OPTIMA_API_SECRET"] ?? "";
const OPTIMA_ACCT   = Number(process.env["OPTIMA_ACCOUNT_ID"] ?? "14");

const OPTIMA_STK_URL    = "https://optimapaybridge.co.ke/api/v2/stkpush.php";
const OPTIMA_STATUS_URL = "https://optimapaybridge.co.ke/api/v2/status.php";
const OPTIMA_CRYPTO_URL = "https://optimapaybridge.co.ke/api/v2/crypto_deposit.php";

const optimaHeaders = {
  "Content-Type":  "application/json",
  "X-API-Key":     OPTIMA_KEY,
  "X-API-Secret":  OPTIMA_SECRET,
};

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.slice(1);
  if (cleaned.startsWith("254")) return cleaned;
  return cleaned;
}

async function creditWallet(userId: number, amount: number, description: string) {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (wallets.length === 0) return;
  const wallet = wallets[0];
  await db
    .update(walletsTable)
    .set({ balanceMd: wallet.balanceMd + amount, balanceKes: wallet.balanceKes + amount })
    .where(eq(walletsTable.userId, userId));
  await db.insert(transactionsTable).values({ userId, type: "topup", amountMd: amount, description });
}

// ── GET /wallet/:userId ──────────────────────────────────────

router.get("/wallet/:userId", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, params.data.userId));
  if (wallets.length === 0) { res.status(404).json({ error: "Wallet not found" }); return; }
  res.json(wallets[0]);
});

// ── POST /wallet/:userId/stk-push  (OptimaPay M-Pesa) ───────

router.post("/wallet/:userId/stk-push", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { phone, amount } = req.body as { phone: string; amount: number };
  if (!phone || !amount || amount < 1) {
    res.status(400).json({ error: "Phone number and amount (min 1 KES) are required." });
    return;
  }

  const normalizedPhone = normalizePhone(String(phone));
  const reference = `MDW-${params.data.userId}-${Date.now()}`;

  try {
    const apiRes = await fetch(OPTIMA_STK_URL, {
      method: "POST",
      headers: optimaHeaders,
      body: JSON.stringify({
        payment_account_id: OPTIMA_ACCT,
        phone:              normalizedPhone,
        amount:             Math.round(amount),
        reference,
        description: "MaKames Digital wallet top-up",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await apiRes.json() as any;

    if (!data?.success) {
      const msg = data?.message ?? `OptimaPay error ${apiRes.status}`;
      res.status(400).json({ error: msg });
      return;
    }

    res.json({
      success:           true,
      reference,
      checkoutRequestId: data.checkout_request_id ?? reference,
      message:           "STK push sent. Enter your M-Pesa PIN on your phone.",
    });
  } catch (err: any) {
    console.error("OptimaPay STK error:", err?.message);
    res.status(500).json({ error: "Failed to initiate M-Pesa payment. Please try again." });
  }
});

// ── POST /wallet/stk-status  (poll + auto-credit) ───────────

router.post("/wallet/stk-status", async (req, res): Promise<void> => {
  const { checkoutRequestId, userId, amount } = req.body as {
    checkoutRequestId: string;
    userId: number;
    amount: number;
  };

  if (!checkoutRequestId) {
    res.status(400).json({ error: "checkoutRequestId is required" });
    return;
  }

  try {
    const apiRes = await fetch(OPTIMA_STATUS_URL, {
      method: "POST",
      headers: optimaHeaders,
      body: JSON.stringify({ checkout_request_id: checkoutRequestId }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await apiRes.json() as any;

    if (!data?.success) {
      res.json({ status: "pending", message: data?.message ?? "Checking…" });
      return;
    }

    const status = (data.status ?? "pending").toLowerCase();

    if (status === "completed") {
      const paidAmount = Number(data.amount ?? amount);
      if (userId > 0 && paidAmount > 0) {
        await creditWallet(userId, paidAmount, `M-Pesa top-up (OptimaPay): ${paidAmount} KES — Ref: ${data.transaction_code ?? checkoutRequestId}`);
      }
      res.json({ status: "completed", amount: paidAmount, transactionCode: data.transaction_code ?? "" });
      return;
    }

    if (status === "failed" || status === "cancelled") {
      res.json({ status: "failed", message: "Payment was not completed." });
      return;
    }

    res.json({ status: "pending" });
  } catch (err: any) {
    console.error("OptimaPay status error:", err?.message);
    res.json({ status: "pending" });
  }
});

// ── POST /wallet/:userId/crypto-checkout  (USDT TRC20) ──────

router.post("/wallet/:userId/crypto-checkout", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { amountUsd } = req.body as { amountUsd: number };
  if (!amountUsd || amountUsd < 1) {
    res.status(400).json({ error: "Minimum $1 USD required." });
    return;
  }

  try {
    const apiRes = await fetch(OPTIMA_CRYPTO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY":    OPTIMA_KEY,
        "X-API-SECRET": OPTIMA_SECRET,
      },
      body: JSON.stringify({
        amount:   amountUsd,
        order_id: `MDW-CRYPTO-${params.data.userId}-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await apiRes.json() as any;

    if (!data?.success) {
      const msg = data?.message ?? "Crypto checkout failed.";
      res.status(400).json({ error: msg });
      return;
    }

    res.json({ success: true, checkoutUrl: data.checkout_url });
  } catch (err: any) {
    console.error("OptimaPay crypto error:", err?.message);
    res.status(500).json({ error: "Failed to create crypto checkout. Please try again." });
  }
});

// ── POST /wallet/:userId/topup  (card / manual) ──────────────

router.post("/wallet/:userId/topup", async (req, res): Promise<void> => {
  const params = TopUpWalletParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = TopUpWalletBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { amountKes, paymentMethod } = parsed.data;
  const amountMd = amountKes;

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, params.data.userId));
  if (wallets.length === 0) { res.status(404).json({ error: "Wallet not found" }); return; }

  const wallet = wallets[0];
  const [updated] = await db
    .update(walletsTable)
    .set({ balanceMd: wallet.balanceMd + amountMd, balanceKes: wallet.balanceKes + amountKes })
    .where(eq(walletsTable.userId, params.data.userId))
    .returning();

  await db.insert(transactionsTable).values({
    userId: params.data.userId,
    type: "topup",
    amountMd,
    description: `Top-up via ${paymentMethod}: ${amountKes} KES`,
  });

  res.json(updated);
});

// ── GET /wallet/:userId/transactions ─────────────────────────

router.get("/wallet/:userId/transactions", async (req, res): Promise<void> => {
  const params = GetTransactionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, params.data.userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  res.json(transactions);
});

export default router;
