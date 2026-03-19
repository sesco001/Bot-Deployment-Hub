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

// ── Cypher X ────────────────────────────────────────────────
const CYPHERX_DEPLOY_URL = "https://xdigitex.space/deploy_proxy.php";
const CYPHERX_MANAGE_URL = "http://164.68.109.104:5050";

async function deployCypherX(sessionId: string, ownerNumber: string): Promise<{ botId: string }> {
  const res = await fetch(CYPHERX_DEPLOY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "cypherx2026" },
    body: JSON.stringify({
      repo_url: "https://github.com/Dark-Xploit/CypherX",
      env: { SESSION_ID: sessionId, OWNER_NUMBER: ownerNumber },
    }),
    signal: AbortSignal.timeout(65000),
  });
  if (!res.ok) throw new Error(`CypherX API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json() as any;
  return { botId: data?.deployment?.id ?? data?.container_id ?? data?.id ?? "unknown" };
}

async function manageCypherX(action: "restart" | "stop" | "delete", botId: string) {
  const method = action === "delete" ? "DELETE" : "POST";
  await fetch(`${CYPHERX_MANAGE_URL}/${action}/${botId}`, {
    method,
    headers: { "Auth-Key": "254MANAGER" },
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

// ── King MD ─────────────────────────────────────────────────
async function deployKingMD(ownerNumber: string, session: string, countryCode: string): Promise<{ botId: string }> {
  const res = await fetch("https://king.xcasper.site/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "kingmd254" },
    body: JSON.stringify({ owner_number: ownerNumber, session, code: countryCode }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`KingMD API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json() as any;
  return { botId: String(data?.id ?? data?.deployment_id ?? "unknown") };
}

// ── BWM-XMD-GO ──────────────────────────────────────────────
const BWM_BASE = "http://173.249.50.158:8443";
const BWM_KEY  = "bwm2542026";

async function deployBWM(botName: string, ownerNumber: string, session: string): Promise<{ botId: string }> {
  const res = await fetch(`${BWM_BASE}/deploy?key=${BWM_KEY}&bot_name=${encodeURIComponent(botName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_name: botName, owner_number: ownerNumber, session }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`BWM API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json() as any;
  return { botId: String(data?.id ?? data?.deployment_id ?? botName) };
}

// ── Atassa Cloud ─────────────────────────────────────────────
const ATASSA_BASE = "https://atassa.xcasper.site";
const ATASSA_KEY  = "atassa2026";

async function deployAtassa(botName: string, sessionId: string): Promise<{ botId: string }> {
  const port = Math.floor(Math.random() * 4999) + 5001; // 5001–9999
  const res = await fetch(`${ATASSA_BASE}/deploy?key=${ATASSA_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_name: botName, session_id: sessionId, port }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Atassa API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json() as any;
  return { botId: String(data?.container_id ?? data?.id ?? botName) };
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
      const result = await deployCypherX(parsedConfig["SESSION_ID"] ?? "", parsedConfig["OWNER_NUMBER"] ?? "");
      externalBotId = result.botId;

    } else if (botTypeId === "king-md") {
      const result = await deployKingMD(
        parsedConfig["OWNER_NUMBER"] ?? "",
        parsedConfig["SESSION_ID"]   ?? "",
        parsedConfig["COUNTRY_CODE"] ?? "254",
      );
      externalBotId = result.botId;

    } else if (botTypeId === "bwm-xmd-go") {
      const uniqueName = safeBotName(botName, userId);
      const result = await deployBWM(uniqueName, parsedConfig["OWNER_NUMBER"] ?? "", parsedConfig["SESSION_ID"] ?? "");
      externalBotId = result.botId;

    } else if (botTypeId === "atassa-cloud") {
      const uniqueName = safeBotName(botName, userId);
      const result = await deployAtassa(uniqueName, parsedConfig["SESSION_ID"] ?? "");
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
