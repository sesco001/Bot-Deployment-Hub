import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, botDeploymentsTable, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import {
  ListDeploymentsQueryParams,
  DeployBotBody,
  GetDeploymentParams,
  UpdateDeploymentParams,
  UpdateDeploymentBody,
  StopDeploymentParams,
  RestartDeploymentParams,
} from "@workspace/api-zod";
import { BOT_TYPES } from "../lib/botTypes.js";

const router: IRouter = Router();

router.get("/bots", async (_req, res): Promise<void> => {
  res.json(BOT_TYPES);
});

router.get("/bots/deployments", async (req, res): Promise<void> => {
  const params = ListDeploymentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const deployments = await db
    .select()
    .from(botDeploymentsTable)
    .where(eq(botDeploymentsTable.userId, params.data.userId));

  res.json(deployments);
});

router.post("/bots/deployments", async (req, res): Promise<void> => {
  const parsed = DeployBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, botTypeId, botName, apiKey, config, useFreeDeployment } = parsed.data;

  const botType = BOT_TYPES.find((b) => b.id === botTypeId);
  if (!botType) {
    res.status(400).json({ error: "Bot type not found" });
    return;
  }

  if (!botType.isActive) {
    res.status(400).json({ error: "This bot is not yet available" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = users[0];
  let isFreeDeployment = false;
  let expiresAt: Date | null = null;

  if (useFreeDeployment && user.freeDeployDaysLeft > 0) {
    // Use free deployment days
    isFreeDeployment = true;
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + user.freeDeployDaysLeft);

    await db
      .update(usersTable)
      .set({ freeDeployDaysLeft: 0 })
      .where(eq(usersTable.id, userId));
  } else {
    // Deduct from wallet
    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (wallets.length === 0) {
      res.status(400).json({ error: "Wallet not found" });
      return;
    }

    const wallet = wallets[0];
    if (wallet.balanceMd < botType.costMd) {
      res.status(400).json({ error: `Insufficient balance. You need ${botType.costMd} MDs but have ${wallet.balanceMd} MDs.` });
      return;
    }

    await db
      .update(walletsTable)
      .set({
        balanceMd: wallet.balanceMd - botType.costMd,
        balanceKes: wallet.balanceKes - botType.costMd,
      })
      .where(eq(walletsTable.userId, userId));

    // Record transaction
    await db.insert(transactionsTable).values({
      userId,
      type: "deduction",
      amountMd: -botType.costMd,
      description: `Bot deployment: ${botName} (${botType.name})`,
    });
  }

  const [deployment] = await db.insert(botDeploymentsTable).values({
    userId,
    botTypeId,
    botName,
    status: "running",
    apiKey: apiKey ?? null,
    config: config ?? null,
    isFreeDeployment,
    expiresAt,
  }).returning();

  res.status(201).json(deployment);
});

router.get("/bots/deployments/:deploymentId", async (req, res): Promise<void> => {
  const params = GetDeploymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const deployments = await db
    .select()
    .from(botDeploymentsTable)
    .where(eq(botDeploymentsTable.id, params.data.deploymentId));

  if (deployments.length === 0) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.json(deployments[0]);
});

router.patch("/bots/deployments/:deploymentId", async (req, res): Promise<void> => {
  const params = UpdateDeploymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDeploymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.botName !== undefined && parsed.data.botName !== null) updateData.botName = parsed.data.botName;
  if (parsed.data.apiKey !== undefined) updateData.apiKey = parsed.data.apiKey;
  if (parsed.data.config !== undefined) updateData.config = parsed.data.config;
  if (parsed.data.status !== undefined && parsed.data.status !== null) updateData.status = parsed.data.status;

  const [deployment] = await db
    .update(botDeploymentsTable)
    .set(updateData)
    .where(eq(botDeploymentsTable.id, params.data.deploymentId))
    .returning();

  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.json(deployment);
});

router.delete("/bots/deployments/:deploymentId", async (req, res): Promise<void> => {
  const params = StopDeploymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deployment] = await db
    .delete(botDeploymentsTable)
    .where(eq(botDeploymentsTable.id, params.data.deploymentId))
    .returning();

  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/bots/deployments/:deploymentId/restart", async (req, res): Promise<void> => {
  const params = RestartDeploymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deployment] = await db
    .update(botDeploymentsTable)
    .set({ status: "running" })
    .where(eq(botDeploymentsTable.id, params.data.deploymentId))
    .returning();

  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.json(deployment);
});

export default router;
