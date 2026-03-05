import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const usageHistories = mysqlTable(
  "usageHistories",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    provider: varchar("provider", { length: 50 }).notNull(), // 'claude', 'openai', 'gemini'
    model: varchar("model", { length: 255 }).notNull(),
    conversationId: varchar("conversationId", { length: 255 }),
    promptId: varchar("promptId", { length: 255 }),
    inputTokens: int("inputTokens").default(0),
    outputTokens: int("outputTokens").default(0),
    totalTokens: int("totalTokens").default(0),
    costUsd: text("costUsd"), // Store as decimal string to avoid floating point issues
    timestamp: timestamp("timestamp").notNull(),
    metadata: text("metadata"), // JSON string for additional data
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userIdx: index("usageHistories_userId_idx").on(table.userId),
    projectIdx: index("usageHistories_projectId_idx").on(table.projectId),
    userProjectIdx: index("usageHistories_user_project_idx").on(table.userId, table.projectId),
    timestampIdx: index("usageHistories_timestamp_idx").on(table.timestamp),
    providerIdx: index("usageHistories_provider_idx").on(table.provider),
    modelIdx: index("usageHistories_model_idx").on(table.model),
    conversationIdx: index("usageHistories_conversationId_idx").on(table.conversationId),
  }),
);

export type UsageHistory = typeof usageHistories.$inferSelect;
export type InsertUsageHistory = typeof usageHistories.$inferInsert;

export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  theme: varchar("theme", { length: 20 }).default("light"),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  forecastingDays: int("forecastingDays").default(30),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
