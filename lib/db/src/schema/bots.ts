import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botDeploymentsTable = pgTable("bot_deployments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  botTypeId: text("bot_type_id").notNull(),
  botName: text("bot_name").notNull(),
  status: text("status").notNull().default("pending"), // running, stopped, error, pending
  apiKey: text("api_key"),
  config: text("config"),
  isFreeDeployment: boolean("is_free_deployment").notNull().default(false),
  deployedAt: timestamp("deployed_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredUserId: integer("referred_user_id").notNull().unique(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBotDeploymentSchema = createInsertSchema(botDeploymentsTable).omit({ id: true, deployedAt: true, updatedAt: true });
export type InsertBotDeployment = z.infer<typeof insertBotDeploymentSchema>;
export type BotDeployment = typeof botDeploymentsTable.$inferSelect;

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, joinedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
