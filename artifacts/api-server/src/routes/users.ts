import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  GetUserParams,
} from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/users/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, email, password, referralCode } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existingUsername.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  let referredBy: number | undefined = undefined;
  if (referralCode) {
    const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (referrer.length > 0) {
      referredBy = referrer[0].id;
    }
  }

  const myReferralCode = generateReferralCode();
  const passwordHash = hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    referralCode: myReferralCode,
    referredBy: referredBy ?? null,
    freeDeployDaysLeft: 0,
  }).returning();

  // Create wallet for the user
  await db.insert(walletsTable).values({
    userId: user.id,
    balanceMd: 0,
    balanceKes: 0,
  });

  // If referred, track the referral and check if referrer gets reward
  if (referredBy) {
    const { referralsTable } = await import("@workspace/db");
    const { count } = await import("drizzle-orm");

    await db.insert(referralsTable).values({
      referrerId: referredBy,
      referredUserId: user.id,
    });

    // Count how many referrals the referrer now has
    const referralCount = await db
      .select({ count: count() })
      .from(referralsTable)
      .where(eq(referralsTable.referrerId, referredBy));

    const total = Number(referralCount[0]?.count ?? 0);
    // Every 5 referrals grants 3 free days
    if (total % 5 === 0) {
      await db
        .update(usersTable)
        .set({ freeDeployDaysLeft: 3 })
        .where(eq(usersTable.id, referredBy));
    }
  }

  res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    freeDeployDaysLeft: user.freeDeployDaysLeft,
    createdAt: user.createdAt,
  });
});

router.post("/users/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = hashPassword(password);

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (users.length === 0 || users[0].passwordHash !== passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const user = users[0];
  const token = `token-${user.id}-${crypto.randomBytes(8).toString("hex")}`;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      freeDeployDaysLeft: user.freeDeployDaysLeft,
      createdAt: user.createdAt,
    },
    token,
  });
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = users[0];
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    freeDeployDaysLeft: user.freeDeployDaysLeft,
    createdAt: user.createdAt,
  });
});

export default router;
