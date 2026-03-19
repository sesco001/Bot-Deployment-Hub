import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

const CYPHERX_DEPLOY_URL = process.env["CYPHERX_DEPLOY_URL"] || "https://xdigitex.space/deploy_proxy.php";
const CYPHERX_MANAGE_URL = process.env["CYPHERX_MANAGE_URL"] || "http://164.68.109.104:5050";
const CYPHERX_API_KEY = process.env["CYPHERX_API_KEY"] || "cypherx2026";

async function deployCypherX(sessionId: string, ownerNumber: string): Promise<{ containerId: string }> {
  const res = await fetch(CYPHERX_DEPLOY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": CYPHERX_API_KEY },
    body: JSON.stringify({
      repo_url: "https://github.com/Dark-Xploit/CypherX",
      env: { SESSION_ID: sessionId, OWNER_NUMBER: ownerNumber },
    }),
    signal: AbortSignal.timeout(65000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`CypherX API error ${res.status}: ${text}`);
  }

  const data = await res.json() as any;
  const containerId: string =
    data?.deployment?.id ?? data?.container_id ?? data?.id ?? "unknown";
  return { containerId };
}

async function manageCypherX(action: "restart" | "stop" | "delete", botId: string) {
  const methodMap = { restart: "POST", stop: "POST", delete: "DELETE" } as const;
  const method = methodMap[action];
  await fetch(`${CYPHERX_MANAGE_URL}/${action}/${botId}`, {
    method,
    headers: { "Auth-Key": "254MANAGER" },
    signal: AbortSignal.timeout(15000),
  });
}

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
    isFreeDeployment = true;
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + user.freeDeployDaysLeft);
    await db.update(usersTable).set({ freeDeployDaysLeft: 0 }).where(eq(usersTable.id, userId));
  } else {
    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (wallets.length === 0) {
      res.status(400).json({ error: "Wallet not found" });
      return;
    }

    const wallet = wallets[0];
    if (wallet.balanceMd < botType.costMd) {
      res.status(400).json({
        error: `Insufficient balance. You need ${botType.costMd} MDs but have ${wallet.balanceMd} MDs.`,
      });
      return;
    }

    await db
      .update(walletsTable)
      .set({ balanceMd: wallet.balanceMd - botType.costMd, balanceKes: wallet.balanceKes - botType.costMd })
      .where(eq(walletsTable.userId, userId));

    await db.insert(transactionsTable).values({
      userId,
      type: "deduction",
      amountMd: -botType.costMd,
      description: `Bot deployment: ${botName} (${botType.name})`,
    });
  }

  let externalContainerId: string | null = null;
  let deployStatus: "running" | "stopped" | "pending" = "running";

  if (botTypeId === "cypher-x") {
    let parsedConfig: Record<string, string> = {};
    try {
      parsedConfig = config ? JSON.parse(config) : {};
    } catch {}

    const sessionId = parsedConfig["SESSION_ID"] ?? "";
    const ownerNumber = parsedConfig["OWNER_NUMBER"] ?? "";

    try {
      const result = await deployCypherX(sessionId, ownerNumber);
      externalContainerId = result.containerId;
      deployStatus = "running";
    } catch (err: any) {
      console.error("CypherX deploy error:", err?.message);
      deployStatus = "pending";
    }
  }

  const [deployment] = await db.insert(botDeploymentsTable).values({
    userId,
    botTypeId,
    botName,
    status: deployStatus,
    apiKey: externalContainerId ?? apiKey ?? null,
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

  const deployments = await db
    .select()
    .from(botDeploymentsTable)
    .where(eq(botDeploymentsTable.id, params.data.deploymentId));

  if (deployments.length === 0) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  const dep = deployments[0];
  if (dep.botTypeId === "cypher-x" && dep.apiKey) {
    manageCypherX("delete", dep.apiKey).catch(() => {});
  }

  await db.delete(botDeploymentsTable).where(eq(botDeploymentsTable.id, params.data.deploymentId));

  res.sendStatus(204);
});

router.post("/bots/deployments/:deploymentId/restart", async (req, res): Promise<void> => {
  const params = RestartDeploymentParams.safeParse(req.params);
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

  const dep = deployments[0];
  if (dep.botTypeId === "cypher-x" && dep.apiKey) {
    manageCypherX("restart", dep.apiKey).catch(() => {});
  }

  const [deployment] = await db
    .update(botDeploymentsTable)
    .set({ status: "running" })
    .where(eq(botDeploymentsTable.id, params.data.deploymentId))
    .returning();

  res.json(deployment);
});

export default router;
