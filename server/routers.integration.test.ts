import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => {
  const now = new Date("2026-03-05T00:00:00Z");
  return {
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    deleteUsageEntry: vi.fn(),
    getUsageEntriesForAnalytics: vi.fn(async () => [
      {
        id: 1,
        provider: "claude",
        model: "claude-3-5-sonnet",
        conversationId: "conv-1",
        promptId: "prompt-1",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costUsd: 1.25,
        timestamp: now,
        metadata: { source: "test" },
        projectId: 10,
      },
    ]),
    getUsageEntryDetail: vi.fn(async () => ({
      id: 1,
      provider: "claude",
      model: "claude-3-5-sonnet",
      conversationId: "conv-1",
      promptId: "prompt-1",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costUsd: 1.25,
      timestamp: now,
      metadata: { source: "test" },
      projectId: 10,
    })),
    getUsageFilterOptions: vi.fn(async () => ({ providers: ["claude"], models: ["claude-3-5-sonnet"] })),
    getUserPreferences: vi.fn(async () => ({
      id: 1,
      userId: 1,
      currency: "USD",
      theme: "light",
      timezone: "UTC",
      forecastingDays: 30,
      createdAt: now,
      updatedAt: now,
    })),
    getUserProjects: vi.fn(async () => [{ id: 10, userId: 1, name: "P1", createdAt: now, updatedAt: now }]),
    importUsageEntries: vi.fn(async () => ({ imported: 1 })),
    listUsageEntries: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    updateProject: vi.fn(),
    upsertUserPreferences: vi.fn(),
  };
});

const { appRouter } = await import("./routers");

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

const user = {
  id: 1,
  openId: "u-1",
  email: "u@example.com",
  name: "Test User",
  loginMethod: "manus",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("appRouter integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects protected usage import when unauthenticated", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(
      caller.usage.import({
        projectId: 10,
        entries: [
          {
            provider: "claude",
            model: "claude-3-5-sonnet",
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            costUsd: 0.01,
            timestamp: new Date(),
          },
        ],
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("Please login") });
  });

  it("returns dashboard analytics payload", async () => {
    const caller = appRouter.createCaller(createContext(user));
    const result = await caller.analytics.dashboard({
      filters: { projectId: 10 },
      days: 7,
    });

    expect(result.summary.totalEntries).toBe(1);
    expect(result.providerStats).toHaveLength(1);
    expect(result.topConversations).toHaveLength(1);
    expect(Array.isArray(result.forecast)).toBe(true);
  });

  it("returns export payload for JSON and CSV", async () => {
    const caller = appRouter.createCaller(createContext(user));
    const json = await caller.exports.data({ format: "json", filters: { projectId: 10 } });
    const csv = await caller.exports.data({ format: "csv", filters: { projectId: 10 } });

    expect(json.contentType).toBe("application/json");
    expect(json.content).toContain("claude-3-5-sonnet");
    expect(csv.contentType).toContain("text/csv");
    expect(csv.content).toContain("provider");
  });

  it("enforces preference validation", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(
      caller.preferences.update({
        currency: "US",
      }),
    ).rejects.toBeDefined();
  });
});
