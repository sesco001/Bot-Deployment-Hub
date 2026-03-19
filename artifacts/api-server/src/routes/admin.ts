import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, walletsTable, transactionsTable, botDeploymentsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_KEY = process.env["ADMIN_KEY"] || "makames_admin_2026";

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"] as string | undefined;
  if (!key || key !== ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use("/admin", requireAdmin);

// ── GET /admin/stats ─────────────────────────────────────────
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [userCount]  = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [depCount]   = await db.select({ count: sql<number>`count(*)` }).from(botDeploymentsTable);
  const [txSum]      = await db.select({ total: sql<number>`coalesce(sum(amount_md),0)` })
    .from(transactionsTable).where(eq(transactionsTable.type, "deposit"));
  const [walletSum]  = await db.select({ total: sql<number>`coalesce(sum(balance_md),0)` }).from(walletsTable);
  const [pendingDeps] = await db.select({ count: sql<number>`count(*)` })
    .from(botDeploymentsTable).where(eq(botDeploymentsTable.status, "pending"));

  res.json({
    totalUsers:         Number(userCount.count),
    totalDeployments:   Number(depCount.count),
    pendingDeployments: Number(pendingDeps.count),
    totalDeposited:     Number(txSum.total),
    totalWalletBalance: Number(walletSum.total),
  });
});

// ── GET /admin/users ─────────────────────────────────────────
router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const wallets = await db.select().from(walletsTable);
  const walletMap = Object.fromEntries(wallets.map((w) => [w.userId, w]));
  res.json(users.map((u) => ({ ...u, wallet: walletMap[u.id] ?? null })));
});

// ── PATCH /admin/users/:userId/credit ────────────────────────
router.patch("/admin/users/:userId/credit", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const { amountMd, note } = req.body as { amountMd: number; note?: string };

  if (!userId || !amountMd || amountMd <= 0) {
    res.status(400).json({ error: "userId and positive amountMd are required" });
    return;
  }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (wallets.length === 0) { res.status(404).json({ error: "Wallet not found" }); return; }
  const wallet = wallets[0];

  const [updated] = await db.update(walletsTable)
    .set({ balanceMd: wallet.balanceMd + amountMd, balanceKes: wallet.balanceKes + amountMd })
    .where(eq(walletsTable.userId, userId))
    .returning();

  await db.insert(transactionsTable).values({
    userId,
    type:      "deposit",
    amountMd,
    description: note ? `Admin credit: ${note}` : "Admin manual credit",
  });

  res.json(updated);
});

// ── PATCH /admin/users/:userId/deduct ────────────────────────
router.patch("/admin/users/:userId/deduct", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const { amountMd, note } = req.body as { amountMd: number; note?: string };

  if (!userId || !amountMd || amountMd <= 0) {
    res.status(400).json({ error: "userId and positive amountMd are required" });
    return;
  }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (wallets.length === 0) { res.status(404).json({ error: "Wallet not found" }); return; }
  const wallet = wallets[0];
  const newBal = Math.max(0, wallet.balanceMd - amountMd);

  const [updated] = await db.update(walletsTable)
    .set({ balanceMd: newBal, balanceKes: newBal })
    .where(eq(walletsTable.userId, userId))
    .returning();

  await db.insert(transactionsTable).values({
    userId,
    type:      "deduction",
    amountMd:  -amountMd,
    description: note ? `Admin deduct: ${note}` : "Admin manual deduction",
  });

  res.json(updated);
});

// ── GET /admin/deployments ────────────────────────────────────
router.get("/admin/deployments", async (_req, res): Promise<void> => {
  const deps  = await db.select().from(botDeploymentsTable).orderBy(desc(botDeploymentsTable.deployedAt));
  const users = await db.select().from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  res.json(deps.map((d) => ({ ...d, user: userMap[d.userId] ?? null })));
});

// ── PATCH /admin/deployments/:id/status ──────────────────────
router.patch("/admin/deployments/:id/status", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { status } = req.body as { status: "running" | "stopped" | "pending" };
  if (!["running", "stopped", "pending"].includes(status)) {
    res.status(400).json({ error: "status must be running, stopped or pending" });
    return;
  }
  const [dep] = await db.update(botDeploymentsTable)
    .set({ status })
    .where(eq(botDeploymentsTable.id, id))
    .returning();
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.json(dep);
});

// ── DELETE /admin/deployments/:id ────────────────────────────
router.delete("/admin/deployments/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  await db.delete(botDeploymentsTable).where(eq(botDeploymentsTable.id, id));
  res.sendStatus(204);
});

// ── GET /admin/transactions ───────────────────────────────────
router.get("/admin/transactions", async (_req, res): Promise<void> => {
  const txs   = await db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt)).limit(500);
  const users = await db.select().from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  res.json(txs.map((t) => ({ ...t, user: userMap[t.userId] ?? null })));
});

export default router;
