import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, referralsTable, usersTable } from "@workspace/db";
import {
  GetReferralsParams,
  ApplyReferralBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/referrals/:userId", async (req, res): Promise<void> => {
  const params = GetReferralsParams.safeParse(req.params);
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

  const referrals = await db
    .select({
      id: referralsTable.id,
      referredUserId: referralsTable.referredUserId,
      joinedAt: referralsTable.joinedAt,
    })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, params.data.userId));

  // Get usernames for referred users
  const referralEntries = await Promise.all(
    referrals.map(async (r) => {
      const referredUsers = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, r.referredUserId));
      return {
        id: r.id,
        referredUsername: referredUsers[0]?.username ?? "Unknown",
        joinedAt: r.joinedAt,
      };
    })
  );

  res.json({
    userId: params.data.userId,
    referralCode: user.referralCode,
    referralCount: referrals.length,
    freeDeployDaysLeft: user.freeDeployDaysLeft,
    referrals: referralEntries,
  });
});

router.post("/referrals/apply", async (req, res): Promise<void> => {
  const parsed = ApplyReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, referralCode } = parsed.data;

  // Find the referrer
  const referrers = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
  if (referrers.length === 0) {
    res.status(400).json({ error: "Invalid referral code" });
    return;
  }

  const referrer = referrers[0];
  if (referrer.id === userId) {
    res.status(400).json({ error: "Cannot use your own referral code" });
    return;
  }

  // Check if already referred
  const existing = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referredUserId, userId));

  if (existing.length > 0) {
    res.status(400).json({ error: "Already used a referral code" });
    return;
  }

  // Apply referral
  await db.insert(referralsTable).values({
    referrerId: referrer.id,
    referredUserId: userId,
  });

  await db
    .update(usersTable)
    .set({ referredBy: referrer.id })
    .where(eq(usersTable.id, userId));

  // Count referrer's total referrals
  const referralCount = await db
    .select({ count: count() })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, referrer.id));

  const total = Number(referralCount[0]?.count ?? 0);
  let freeDeployDaysGranted = 0;

  if (total % 5 === 0) {
    freeDeployDaysGranted = 3;
    await db
      .update(usersTable)
      .set({ freeDeployDaysLeft: 3 })
      .where(eq(usersTable.id, referrer.id));
  }

  res.json({
    success: true,
    message: freeDeployDaysGranted > 0
      ? `Referral applied! ${referrer.username} has earned ${freeDeployDaysGranted} free deployment days!`
      : "Referral applied successfully!",
    freeDeployDaysGranted,
  });
});

export default router;
