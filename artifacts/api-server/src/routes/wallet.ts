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
  const amountMd = amountKes; // 1 KES = 1 MD

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, params.data.userId));
  if (wallets.length === 0) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const wallet = wallets[0];
  const [updated] = await db
    .update(walletsTable)
    .set({
      balanceMd: wallet.balanceMd + amountMd,
      balanceKes: wallet.balanceKes + amountKes,
    })
    .where(eq(walletsTable.userId, params.data.userId))
    .returning();

  // Record transaction
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
