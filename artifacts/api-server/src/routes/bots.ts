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
import { BOT_TYPES, DEPLOY_DAYS } from "../lib/botTypes.js";

const router: IRouter = Router();

// ── Digitex Gateway (unified for all 4 bot types) ────────────
const DIGITEX_URL     = "https://api.xdigitex.space/v1/deploy.php";
const DIGITEX_AUTH    = "dx_a6c2ecc10696f578614d5b79abfff621";
const CYPHERX_MANAGE_URL = "http://164.68.109.104:5050";

async function deployViaDigitex(payload: Record<string, string>): Promise<{ botId: string }> {
  const res = await fetch(DIGITEX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-AUTH-KEY": DIGITEX_AUTH },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(65000),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Digitex API ${res.status}: ${text}`);
  let data: any = {};
  try { data = JSON.parse(text); } catch {}
  if (data?.status === "error") throw new Error(`Digitex error: ${data?.message ?? text}`);
  return { botId: String(data?.vps_id ?? "unknown") };
}

async function manageCypherX(action: "restart" | "stop" | "delete", botId: string) {
  const method = action === "delete" ? "DELETE" : "POST";
  await fetch(`${CYPHERX_MANAGE_URL}/${action}/${botId}`, {
    method,
    headers: { "Auth-Key": "254MANAGER" },
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

// ── Helpers ──────────────────────────────────────────────────
function makeExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + DEPLOY_DAYS);
  return d;
}

function safeBotName(name: string, userId: number): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) + "_" + userId + "_" + Date.now();
}

// ── GET /bots ────────────────────────────────────────────────
router.get("/bots", async (_req, res): Promise<void> => {
  res.json(BOT_TYPES);
});

// ── GET /bots/deployments ────────────────────────────────────
router.get("/bots/deployments", async (req, res): Promise<void> => {
  const params = ListDeploymentsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const deployments = await db
    .select()
    .from(botDeploymentsTable)
    .where(eq(botDeploymentsTable.userId, params.data.userId));
  res.json(deployments);
});

// ── POST /bots/deployments ────────────────────────────────────
router.post("/bots/deployments", async (req, res): Promise<void> => {
  const parsed = DeployBotBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { userId, botTypeId, botName, config, useFreeDeployment } = parsed.data;

  const botType = BOT_TYPES.find((b) => b.id === botTypeId);
  if (!botType)        { res.status(400).json({ error: "Bot type not found" }); return; }
  if (!botType.isActive) { res.status(400).json({ error: "This bot is not yet available" }); return; }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (users.length === 0) { res.status(404).json({ error: "User not found" }); return; }
  const user = users[0];

  let isFreeDeployment = false;

  if (useFreeDeployment && user.freeDeployDaysLeft > 0) {
    isFreeDeployment = true;
    await db.update(usersTable).set({ freeDeployDaysLeft: 0 }).where(eq(usersTable.id, userId));
  } else {
    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (wallets.length === 0) { res.status(400).json({ error: "Wallet not found" }); return; }
    const wallet = wallets[0];
    if (wallet.balanceMd < botType.costMd) {
      res.status(400).json({ error: `Insufficient balance. Need ${botType.costMd} MD, have ${wallet.balanceMd} MD.` });
      return;
    }
    await db.update(walletsTable)
      .set({ balanceMd: wallet.balanceMd - botType.costMd, balanceKes: wallet.balanceKes - botType.costMd })
      .where(eq(walletsTable.userId, userId));
    await db.insert(transactionsTable).values({
      userId, type: "deduction", amountMd: -botType.costMd,
      description: `Bot deployment: ${botName} (${botType.name}) — ${DEPLOY_DAYS} days`,
    });
  }

  // All deployments expire in 36 days
  const expiresAt = makeExpiry();
  let externalBotId: string | null = null;
  let deployStatus: "running" | "stopped" | "pending" = "running";

  let parsedConfig: Record<string, string> = {};
  try { parsedConfig = config ? JSON.parse(config) : {}; } catch {}

  try {
    if (botTypeId === "cypher-x") {
      const result = await deployViaDigitex({
        bot_type:     "cypherx",
        owner_number: parsedConfig["OWNER_NUMBER"] ?? "",
        session:      parsedConfig["SESSION_ID"]   ?? "",
      });
      externalBotId = result.botId;

    } else if (botTypeId === "king-md") {
      const result = await deployViaDigitex({
        bot_type:     "king",
        owner_number: parsedConfig["OWNER_NUMBER"] ?? "",
        session:      parsedConfig["SESSION_ID"]   ?? "",
        code:         parsedConfig["COUNTRY_CODE"] ?? "254",
      });
      externalBotId = result.botId;

    } else if (botTypeId === "bwm-xmd-go") {
      const result = await deployViaDigitex({
        bot_type:     "bwm",
        bot_name:     safeBotName(botName, userId),
        owner_number: parsedConfig["OWNER_NUMBER"] ?? "",
        session:      parsedConfig["SESSION_ID"]   ?? "",
      });
      externalBotId = result.botId;

    } else if (botTypeId === "atassa-cloud") {
      const result = await deployViaDigitex({
        bot_type: "atassa",
        bot_name: safeBotName(botName, userId),
        session:  parsedConfig["SESSION_ID"] ?? "",
      });
      externalBotId = result.botId;
    }
  } catch (err: any) {
    console.error(`[${botTypeId}] deploy error:`, err?.message);
    deployStatus = "pending";
  }

  const [deployment] = await db.insert(botDeploymentsTable).values({
    userId, botTypeId, botName,
    status:           deployStatus,
    apiKey:           externalBotId ?? null,
    config:           config ?? null,
    isFreeDeployment,
    expiresAt,
  }).returning();

  res.status(201).json(deployment);
});

// ── GET /bots/deployments/:deploymentId ──────────────────────
router.get("/bots/deployments/:deploymentId", async (req, res): Promise<void> => {
  const params = GetDeploymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(botDeploymentsTable).where(eq(botDeploymentsTable.id, params.data.deploymentId));
  if (rows.length === 0) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.json(rows[0]);
});

// ── PATCH /bots/deployments/:deploymentId ────────────────────
router.patch("/bots/deployments/:deploymentId", async (req, res): Promise<void> => {
  const params = UpdateDeploymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateDeploymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const update: Record<string, unknown> = {};
  if (parsed.data.botName !== undefined && parsed.data.botName !== null) update.botName = parsed.data.botName;
  if (parsed.data.apiKey  !== undefined) update.apiKey  = parsed.data.apiKey;
  if (parsed.data.config  !== undefined) update.config  = parsed.data.config;
  if (parsed.data.status  !== undefined && parsed.data.status !== null) update.status = parsed.data.status;

  const [dep] = await db.update(botDeploymentsTable).set(update)
    .where(eq(botDeploymentsTable.id, params.data.deploymentId)).returning();
  if (!dep) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.json(dep);
});

// ── DELETE /bots/deployments/:deploymentId ───────────────────
router.delete("/bots/deployments/:deploymentId", async (req, res): Promise<void> => {
  const params = StopDeploymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(botDeploymentsTable).where(eq(botDeploymentsTable.id, params.data.deploymentId));
  if (rows.length === 0) { res.status(404).json({ error: "Deployment not found" }); return; }
  const dep = rows[0];
  if (dep.botTypeId === "cypher-x" && dep.apiKey) manageCypherX("delete", dep.apiKey);
  await db.delete(botDeploymentsTable).where(eq(botDeploymentsTable.id, params.data.deploymentId));
  res.sendStatus(204);
});

// ── POST /bots/deployments/:deploymentId/restart ─────────────
router.post("/bots/deployments/:deploymentId/restart", async (req, res): Promise<void> => {
  const params = RestartDeploymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(botDeploymentsTable).where(eq(botDeploymentsTable.id, params.data.deploymentId));
  if (rows.length === 0) { res.status(404).json({ error: "Deployment not found" }); return; }
  const dep = rows[0];
  if (dep.botTypeId === "cypher-x" && dep.apiKey) manageCypherX("restart", dep.apiKey);
  const [updated] = await db.update(botDeploymentsTable)
    .set({ status: "running" })
    .where(eq(botDeploymentsTable.id, params.data.deploymentId))
    .returning();
  res.json(updated);
});

export default router;
