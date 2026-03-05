import {
  calculateDailyStats,
  calculateProviderStats,
  calculateSummaryStats,
  forecastCosts,
  generateRecommendations,
  getTopConversations,
} from "@shared/analyticsEngine";
import {
  analyticsInputSchema,
  exportInputSchema,
  forecastInputSchema,
  topConversationsInputSchema,
  usageDeleteInputSchema,
  usageDetailInputSchema,
  usageImportInputSchema,
  usageListInputSchema,
  usageFilterInputSchema,
} from "@shared/usage";
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createProject,
  deleteProject,
  deleteUsageEntry,
  getUsageEntriesForAnalytics,
  getUsageEntryDetail,
  getUsageFilterOptions,
  getUserPreferences,
  getUserProjects,
  importUsageEntries,
  listUsageEntries,
  updateProject,
  upsertUserPreferences,
} from "./db";

const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

const projectUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

const preferenceUpdateSchema = z.object({
  currency: z.string().trim().toUpperCase().length(3).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  forecastingDays: z.number().int().min(1).max(365).optional(),
});

const projectReportInputSchema = z.object({
  projectId: z.number().int().positive(),
  filters: usageFilterInputSchema.default({}),
});

const toSerializableUsage = (entry: Awaited<ReturnType<typeof getUsageEntriesForAnalytics>>[number]) => ({
  ...entry,
  timestamp: entry.timestamp.toISOString(),
});

const rowsToCsv = (
  rows: Awaited<ReturnType<typeof getUsageEntriesForAnalytics>>,
  timezone: string | null | undefined,
  currency: string | null | undefined,
) => {
  const header = [
    "id",
    "timestamp",
    "provider",
    "model",
    "conversationId",
    "promptId",
    "projectId",
    "inputTokens",
    "outputTokens",
    "totalTokens",
    "costUsd",
  ];

  const resolvedTimeZone = (() => {
    if (!timezone) return "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return "UTC";
    }
  })();

  const fmt = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: resolvedTimeZone,
  });

  const escape = (value: unknown) => `"${String(value ?? "").replaceAll(`"`, `""`)}"`;
  const lines = rows.map(row =>
    [
      row.id,
      fmt.format(row.timestamp),
      row.provider,
      row.model,
      row.conversationId ?? "",
      row.promptId ?? "",
      row.projectId ?? "",
      row.inputTokens,
      row.outputTokens,
      row.totalTokens,
      row.costUsd,
    ]
      .map(escape)
      .join(","),
  );
  const summary = calculateSummaryStats(rows);
  const summaryRows = [
    ["metric", "value"],
    ["currency", currency || "USD"],
    ["totalEntries", summary.totalEntries],
    ["totalCost", summary.totalCost],
    ["totalTokens", summary.totalTokens],
    ["avgDailyCost", summary.avgDailyCost],
  ]
    .map(cols => cols.map(escape).join(","))
    .join("\n");

  return [summaryRows, "", header.join(","), ...lines].join("\n");
};

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  projects: router({
    list: protectedProcedure.query(({ ctx }) => getUserProjects(ctx.user.id)),
    create: protectedProcedure.input(projectCreateSchema).mutation(({ ctx, input }) => {
      return createProject(ctx.user.id, input);
    }),
    update: protectedProcedure.input(projectUpdateSchema).mutation(({ ctx, input }) => {
      const { id, ...changes } = input;
      return updateProject(ctx.user.id, id, changes);
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteProject(ctx.user.id, input.id)),
    report: protectedProcedure.input(projectReportInputSchema).query(async ({ ctx, input }) => {
      const entries = await getUsageEntriesForAnalytics(ctx.user.id, {
        ...input.filters,
        projectId: input.projectId,
      });

      const providerStats = calculateProviderStats(entries);
      const summary = calculateSummaryStats(entries);
      return {
        summary,
        dailyStats: calculateDailyStats(entries),
        providerStats,
        topConversations: getTopConversations(entries, 10),
        recommendations: generateRecommendations(entries, providerStats),
      };
    }),
  }),

  preferences: router({
    get: protectedProcedure.query(({ ctx }) => getUserPreferences(ctx.user.id)),
    update: protectedProcedure.input(preferenceUpdateSchema).mutation(({ ctx, input }) => {
      return upsertUserPreferences(ctx.user.id, input);
    }),
  }),

  usage: router({
    import: protectedProcedure.input(usageImportInputSchema).mutation(({ ctx, input }) => {
      return importUsageEntries(ctx.user.id, input.projectId, input.entries);
    }),
    list: protectedProcedure.input(usageListInputSchema).query(({ ctx, input }) => {
      return listUsageEntries(ctx.user.id, input);
    }),
    detail: protectedProcedure.input(usageDetailInputSchema).query(({ ctx, input }) => {
      return getUsageEntryDetail(ctx.user.id, input.id);
    }),
    delete: protectedProcedure.input(usageDeleteInputSchema).mutation(({ ctx, input }) => {
      return deleteUsageEntry(ctx.user.id, input.id);
    }),
  }),

  analytics: router({
    summary: protectedProcedure.input(analyticsInputSchema).query(async ({ ctx, input }) => {
      const entries = await getUsageEntriesForAnalytics(ctx.user.id, input.filters);
      return calculateSummaryStats(entries);
    }),
    providerBreakdown: protectedProcedure.input(analyticsInputSchema).query(async ({ ctx, input }) => {
      const entries = await getUsageEntriesForAnalytics(ctx.user.id, input.filters);
      return calculateProviderStats(entries);
    }),
    topConversations: protectedProcedure
      .input(topConversationsInputSchema)
      .query(async ({ ctx, input }) => {
        const entries = await getUsageEntriesForAnalytics(ctx.user.id, input.filters);
        return getTopConversations(entries, input.limit);
      }),
    forecast: protectedProcedure.input(forecastInputSchema).query(async ({ ctx, input }) => {
      const entries = await getUsageEntriesForAnalytics(ctx.user.id, input.filters);
      return forecastCosts(calculateDailyStats(entries), input.days);
    }),
    recommendations: protectedProcedure
      .input(analyticsInputSchema)
      .query(async ({ ctx, input }) => {
        const entries = await getUsageEntriesForAnalytics(ctx.user.id, input.filters);
        const providerStats = calculateProviderStats(entries);
        return generateRecommendations(entries, providerStats);
      }),
    filterOptions: protectedProcedure
      .input(analyticsInputSchema)
      .query(({ ctx, input }) => getUsageFilterOptions(ctx.user.id, input.filters)),
    dashboard: protectedProcedure.input(forecastInputSchema).query(async ({ ctx, input }) => {
      const entries = await getUsageEntriesForAnalytics(ctx.user.id, input.filters);
      const providerStats = calculateProviderStats(entries);
      const dailyStats = calculateDailyStats(entries);
      return {
        summary: calculateSummaryStats(entries),
        providerStats,
        dailyStats,
        topConversations: getTopConversations(entries, 20),
        recommendations: generateRecommendations(entries, providerStats),
        forecast: forecastCosts(dailyStats, input.days),
        totalRows: entries.length,
      };
    }),
  }),

  exports: router({
    data: protectedProcedure.input(exportInputSchema).mutation(async ({ ctx, input }) => {
      const [rows, preferences] = await Promise.all([
        getUsageEntriesForAnalytics(ctx.user.id, input.filters),
        getUserPreferences(ctx.user.id),
      ]);

      if (input.format === "json") {
        const summary = calculateSummaryStats(rows);
        return {
          filename: `usage-export-${Date.now()}.json`,
          contentType: "application/json",
          content: JSON.stringify(
            {
              summary,
              rows: rows.map(toSerializableUsage),
            },
            null,
            2,
          ),
        };
      }

      return {
        filename: `usage-export-${Date.now()}.csv`,
        contentType: "text/csv;charset=utf-8",
        content: rowsToCsv(rows, preferences?.timezone, preferences?.currency),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
