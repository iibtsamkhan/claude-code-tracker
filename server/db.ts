import type { UsageAnalyticsEntry } from "@shared/analyticsEngine";
import type { UsageEntryInput, UsageFilterInput, UsageListInput } from "@shared/usage";
import { and, asc, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertProject,
  InsertUser,
  InsertUserPreferences,
  projects,
  usageHistories,
  userPreferences,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Project queries
export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId));
}

export async function createProject(userId: number, data: Omit<InsertProject, 'userId'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values({ ...data, userId });
  return result;
}

export async function updateProject(userId: number, projectId: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(projects)
    .set(data)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

export async function deleteProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

// User preferences queries
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserPreferences(userId: number, data: Omit<Partial<InsertUserPreferences>, 'userId'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserPreferences(userId);
  if (existing) {
    return db.update(userPreferences).set(data).where(eq(userPreferences.userId, userId));
  } else {
    return db.insert(userPreferences).values({ ...data, userId });
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function normalizeUsageHistoryRow(row: typeof usageHistories.$inferSelect): UsageAnalyticsEntry & { id: number } {
  return {
    id: row.id,
    provider: row.provider as UsageAnalyticsEntry["provider"],
    model: row.model,
    projectId: row.projectId,
    conversationId: row.conversationId ?? undefined,
    promptId: row.promptId ?? undefined,
    inputTokens: row.inputTokens ?? 0,
    outputTokens: row.outputTokens ?? 0,
    totalTokens: row.totalTokens ?? 0,
    costUsd: row.costUsd ? Number(row.costUsd) : 0,
    timestamp: row.timestamp,
    metadata: parseMetadata(row.metadata),
  };
}

function buildUsageWhere(userId: number, filters: UsageFilterInput) {
  const conditions: any[] = [eq(usageHistories.userId, userId)];

  if (filters.projectId) {
    conditions.push(eq(usageHistories.projectId, filters.projectId));
  }
  if (filters.provider) {
    conditions.push(eq(usageHistories.provider, filters.provider));
  }
  if (filters.model) {
    conditions.push(like(usageHistories.model, `%${filters.model}%`));
  }
  if (filters.search) {
    conditions.push(
      or(
        like(usageHistories.model, `%${filters.search}%`),
        like(usageHistories.conversationId, `%${filters.search}%`),
        like(usageHistories.promptId, `%${filters.search}%`),
      )!,
    );
  }
  if (filters.dateFrom) {
    conditions.push(gte(usageHistories.timestamp, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(usageHistories.timestamp, filters.dateTo));
  }
  if (filters.minCost !== undefined) {
    conditions.push(sql`CAST(${usageHistories.costUsd} AS DECIMAL(18,8)) >= ${filters.minCost}`);
  }
  if (filters.maxCost !== undefined) {
    conditions.push(sql`CAST(${usageHistories.costUsd} AS DECIMAL(18,8)) <= ${filters.maxCost}`);
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions)!;
}

function getOrderBy(sort: UsageListInput["sort"]) {
  if (sort.sortBy === "timestamp") {
    return sort.sortDir === "asc" ? asc(usageHistories.timestamp) : desc(usageHistories.timestamp);
  }
  if (sort.sortBy === "totalTokens") {
    return sort.sortDir === "asc" ? asc(usageHistories.totalTokens) : desc(usageHistories.totalTokens);
  }
  const costExpr = sql<number>`CAST(${usageHistories.costUsd} AS DECIMAL(18,8))`;
  return sort.sortDir === "asc" ? asc(costExpr) : desc(costExpr);
}

export async function importUsageEntries(
  userId: number,
  projectId: number,
  entries: UsageEntryInput[],
): Promise<{ imported: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const chunkSize = 1000;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    await db.insert(usageHistories).values(
      chunk.map(entry => ({
        userId,
        projectId,
        provider: entry.provider,
        model: entry.model,
        conversationId: entry.conversationId,
        promptId: entry.promptId,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        totalTokens: entry.totalTokens,
        costUsd: String(entry.costUsd),
        timestamp: entry.timestamp,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      })),
    );
  }

  return { imported: entries.length };
}

export async function listUsageEntries(userId: number, input: UsageListInput) {
  const db = await getDb();
  if (!db) {
    return { items: [], total: 0, page: input.pagination.page, pageSize: input.pagination.pageSize };
  }

  const where = buildUsageWhere(userId, input.filters);
  const offset = (input.pagination.page - 1) * input.pagination.pageSize;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(usageHistories)
      .where(where)
      .orderBy(getOrderBy(input.sort))
      .limit(input.pagination.pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(usageHistories)
      .where(where),
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map(normalizeUsageHistoryRow),
    total,
    page: input.pagination.page,
    pageSize: input.pagination.pageSize,
  };
}

export async function getUsageEntryDetail(userId: number, id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(usageHistories)
    .where(and(eq(usageHistories.id, id), eq(usageHistories.userId, userId)))
    .limit(1);

  return rows[0] ? normalizeUsageHistoryRow(rows[0]) : null;
}

export async function deleteUsageEntry(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .delete(usageHistories)
    .where(and(eq(usageHistories.id, id), eq(usageHistories.userId, userId)));
}

export async function getUsageEntriesForAnalytics(userId: number, filters: UsageFilterInput) {
  const db = await getDb();
  if (!db) return [] as Array<UsageAnalyticsEntry & { id: number }>;

  const rows = await db
    .select()
    .from(usageHistories)
    .where(buildUsageWhere(userId, filters))
    .orderBy(asc(usageHistories.timestamp));

  return rows.map(normalizeUsageHistoryRow);
}

export async function getUsageFilterOptions(userId: number, filters: UsageFilterInput) {
  const entries = await getUsageEntriesForAnalytics(userId, filters);
  const providers = Array.from(new Set(entries.map(entry => entry.provider))).sort();
  const models = Array.from(new Set(entries.map(entry => entry.model))).sort();
  return { providers, models };
}
