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

const PAYHERO_AUTH_TOKEN = process.env["PAYHERO_AUTH_TOKEN"] || "";
const PAYHERO_CHANNEL_ID = Number(process.env["PAYHERO_CHANNEL_ID"] || "5962");
const PAYHERO_URL = "https://backend.payhero.co.ke/api/v2/payments";

function getCallbackUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "";
  if (domain) return `https://${domain}/api/wallet/payhero-callback`;
  return "https://makamesdigital.replit.app/api/wallet/payhero-callback";
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.slice(1);
  if (cleaned.startsWith("254")) return cleaned;
  return cleaned;
}

router.get("/wallet/:userId", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, params.data.userId));
  if (wallets.length === 0) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.json(wallets[0]);
});

router.post("/wallet/:userId/stk-push", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { phone, amount } = req.body as { phone: string; amount: number };

  if (!phone || !amount || amount < 10) {
    res.status(400).json({ error: "Phone number and amount (min 10 KES) are required." });
    return;
  }

  const normalizedPhone = normalizePhone(String(phone));
  const reference = `MD-${params.data.userId}-${Date.now()}`;

  const payload = {
    amount: Math.round(amount),
    phone_number: normalizedPhone,
    channel_id: PAYHERO_CHANNEL_ID,
    provider: "m-pesa",
    external_reference: reference,
    callback_url: getCallbackUrl(),
  };

  try {
    const phRes = await fetch(PAYHERO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: PAYHERO_AUTH_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const data = await phRes.json() as any;

    if (!phRes.ok) {
      const msg = data?.message ?? data?.error ?? `PayHero error ${phRes.status}`;
      res.status(400).json({ error: msg });
      return;
    }

    res.json({
      success: true,
      reference,
      checkoutRequestId: data?.CheckoutRequestID ?? data?.checkout_request_id ?? reference,
      message: "STK push sent. Enter PIN on your phone to complete payment.",
    });
  } catch (err: any) {
    console.error("PayHero STK error:", err?.message);
    res.status(500).json({ error: "Failed to initiate M-Pesa payment. Please try again." });
  }
});

router.post("/wallet/payhero-callback", async (req, res): Promise<void> => {
  try {
    const body = req.body as any;
    const status = body?.Status ?? body?.status ?? "";
    const reference = body?.ExternalReference ?? body?.external_reference ?? "";

    if ((status === "Success" || status === "success" || status === "COMPLETE") && reference) {
      const parts = reference.split("-");
      const userId = parseInt(parts[1] ?? "0", 10);
      const amount = Number(body?.Amount ?? body?.amount ?? 0);

      if (userId > 0 && amount > 0) {
        const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
        if (wallets.length > 0) {
          const wallet = wallets[0];
          await db
            .update(walletsTable)
            .set({ balanceMd: wallet.balanceMd + amount, balanceKes: wallet.balanceKes + amount })
            .where(eq(walletsTable.userId, userId));

          await db.insert(transactionsTable).values({
            userId,
            type: "topup",
            amountMd: amount,
            description: `M-Pesa top-up (PayHero): ${amount} KES`,
          });
        }
      }
    }

    res.json({ status: "received" });
  } catch (err: any) {
    console.error("PayHero callback error:", err?.message);
    res.json({ status: "received" });
  }
});

router.post("/wallet/:userId/topup", async (req, res): Promise<void> => {
  const params = TopUpWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = TopUpWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amountKes } = parsed.data;
  const amountMd = amountKes;

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, params.data.userId));
  if (wallets.length === 0) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

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
    description: `Top-up via ${parsed.data.paymentMethod}: ${amountKes} KES`,
  });

  res.json(updated);
});

router.get("/wallet/:userId/transactions", async (req, res): Promise<void> => {
  const params = GetTransactionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, params.data.userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  res.json(transactions);
});

export default router;
