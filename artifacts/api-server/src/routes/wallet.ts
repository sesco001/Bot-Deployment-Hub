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

// GiftedTech — low-fee M-Pesa STK (no API key required)
const GIFTED_STK_URL    = "https://mpesa-stk.giftedtech.co.ke/api/payMaka.php";
const GIFTED_VERIFY_URL = "https://mpesa-stk.giftedtech.co.ke/api/verify-transaction.php";

// OptimaPay — crypto only
const OPTIMA_KEY        = process.env["OPTIMA_API_KEY"]    ?? "";
const OPTIMA_SECRET     = process.env["OPTIMA_API_SECRET"] ?? "";
const OPTIMA_ACCOUNT_ID = 14;
const OPTIMA_CRYPTO_URL = "https://optimapaybridge.co.ke/api/v2/crypto_deposit.php";

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

// ── POST /wallet/:userId/stk-push  (GiftedTech M-Pesa) ──────

router.post("/wallet/:userId/stk-push", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { phone, amount } = req.body as { phone: string; amount: number };
  if (!phone || !amount || amount < 1) {
    res.status(400).json({ error: "Phone number and amount (min 1 KES) are required." });
    return;
  }

  const normalizedPhone = normalizePhone(String(phone));

  if (!normalizedPhone.startsWith("254") || normalizedPhone.length !== 12) {
    res.status(400).json({ error: "Enter a valid Safaricom number (e.g. 0712345678)." });
    return;
  }

  try {
    const apiRes = await fetch(GIFTED_STK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: normalizedPhone, amount: String(Math.round(amount)) }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await apiRes.json() as any;

    if (!data?.success || !data?.CheckoutRequestID) {
      const msg = data?.message ?? data?.error ?? "STK push failed. Please try again.";
      res.status(400).json({ error: msg });
      return;
    }

    res.json({
      success:           true,
      checkoutRequestId: data.CheckoutRequestID,
      message:           "STK push sent. Enter your M-Pesa PIN on your phone.",
    });
  } catch (err: any) {
    console.error("GiftedTech STK error:", err?.message);
    res.status(500).json({ error: "Failed to initiate M-Pesa payment. Please try again." });
  }
});

// ── POST /wallet/stk-status  (GiftedTech verify + auto-credit)

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
    const apiRes = await fetch(GIFTED_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutRequestId }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await apiRes.json() as any;
    const status = (data?.status ?? "pending").toLowerCase();
    const resultDesc  = data?.data?.ResultDesc ?? "";
    const receiptCode = data?.data?.MpesaReceiptNumber ?? "";

    // Only credit on EXACT "completed" status — "cancelled", "failed", or any other
    // status must NEVER credit the wallet, even if ResultDesc is non-empty.
    const isCompleted = status === "completed";
    const isFailed    = status === "failed" || status === "cancelled" || status === "canceled";

    if (isCompleted) {
      const paidAmount = Number(data?.data?.Amount ?? amount);
      const creditAmt  = paidAmount > 0 ? paidAmount : amount;
      if (userId > 0 && creditAmt > 0) {
        const desc = receiptCode
          ? `M-Pesa top-up: ${creditAmt} KES — Code: ${receiptCode}`
          : `M-Pesa top-up: ${creditAmt} KES`;
        await creditWallet(userId, creditAmt, desc);
      }
      res.json({ status: "completed", amount: creditAmt, transactionCode: receiptCode, resultDesc });
      return;
    }

    if (isFailed) {
      res.json({ status: "failed", message: resultDesc || "Payment was cancelled or not completed." });
      return;
    }

    res.json({ status: "pending" });
  } catch (err: any) {
    console.error("GiftedTech verify error:", err?.message);
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

  const orderId  = `TXN_${params.data.userId}_${Date.now()}`;
  const payload  = {
    amount:             parseFloat(amountUsd.toFixed(2)),
    order_id:           orderId,
    payment_account_id: OPTIMA_ACCOUNT_ID,
  };

  console.log("[crypto-checkout] → OptimaPay payload:", JSON.stringify(payload));
  console.log("[crypto-checkout] → key length:", OPTIMA_KEY.length, "secret length:", OPTIMA_SECRET.length);

  try {
    const apiRes = await fetch(OPTIMA_CRYPTO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY":    OPTIMA_KEY,
        "X-API-SECRET": OPTIMA_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });

    const rawText = await apiRes.text();
    console.log("[crypto-checkout] ← OptimaPay HTTP:", apiRes.status, "body:", rawText.slice(0, 500));

    let data: any = {};
    try { data = JSON.parse(rawText); } catch { /* empty body or non-JSON */ }

    if (data?.success === true && data?.checkout_url) {
      res.json({ success: true, checkoutUrl: data.checkout_url });
      return;
    }

    const msg = data?.message ?? data?.error
      ?? (apiRes.status === 500
          ? "Crypto gateway returned an error (HTTP 500). Please verify your OptimaPay API credentials are correct and the account is active."
          : `OptimaPay error (HTTP ${apiRes.status})`);
    res.status(400).json({ error: msg });
  } catch (err: any) {
    console.error("[crypto-checkout] fetch error:", err?.message);
    res.status(500).json({ error: "Network error reaching payment gateway. Please try again." });
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
