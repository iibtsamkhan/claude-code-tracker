import { z } from "zod";

export const aiProviderSchema = z.enum(["claude", "openai", "gemini"]);

export const usageEntryInputSchema = z.object({
  provider: aiProviderSchema,
  model: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  promptId: z.string().min(1).optional(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  timestamp: z.coerce.date(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const usageFilterInputSchema = z.object({
  projectId: z.number().int().positive().optional(),
  provider: aiProviderSchema.optional(),
  model: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  minCost: z.number().min(0).optional(),
  maxCost: z.number().min(0).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const usagePaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(250).default(25),
});

export const usageSortSchema = z.object({
  sortBy: z.enum(["timestamp", "costUsd", "totalTokens"]).default("timestamp"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const usageListInputSchema = z.object({
  filters: usageFilterInputSchema.default({}),
  pagination: usagePaginationSchema.default({ page: 1, pageSize: 25 }),
  sort: usageSortSchema.default({ sortBy: "timestamp", sortDir: "desc" }),
});

export const usageImportInputSchema = z.object({
  projectId: z.number().int().positive(),
  entries: z.array(usageEntryInputSchema).min(1).max(50_000),
});

export const analyticsInputSchema = z.object({
  filters: usageFilterInputSchema.default({}),
});

export const topConversationsInputSchema = z.object({
  filters: usageFilterInputSchema.default({}),
  limit: z.number().int().min(1).max(100).default(20),
});

export const forecastInputSchema = z.object({
  filters: usageFilterInputSchema.default({}),
  days: z.number().int().min(1).max(365).default(30),
});

export const usageDeleteInputSchema = z.object({
  id: z.number().int().positive(),
});

export const usageDetailInputSchema = z.object({
  id: z.number().int().positive(),
});

export const exportInputSchema = z.object({
  format: z.enum(["csv", "json"]),
  filters: usageFilterInputSchema.default({}),
});

export type AIProvider = z.infer<typeof aiProviderSchema>;
export type UsageEntryInput = z.infer<typeof usageEntryInputSchema>;
export type UsageFilterInput = z.infer<typeof usageFilterInputSchema>;
export type UsageListInput = z.infer<typeof usageListInputSchema>;
