import { describe, it, expect } from "vitest";
import {
  calculateDailyStats,
  calculateProviderStats,
  getTopConversations,
  forecastCosts,
  generateRecommendations,
  calculateSummaryStats,
  ParsedUsageEntry,
} from "./analytics";

const mockEntries: ParsedUsageEntry[] = [
  {
    provider: "claude",
    model: "claude-3-5-sonnet",
    conversationId: "conv-1",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    costUsd: 0.0105,
    timestamp: new Date("2026-03-01"),
  },
  {
    provider: "claude",
    model: "claude-3-5-sonnet",
    conversationId: "conv-2",
    inputTokens: 2000,
    outputTokens: 1000,
    totalTokens: 3000,
    costUsd: 0.021,
    timestamp: new Date("2026-03-01"),
  },
  {
    provider: "openai",
    model: "gpt-4",
    conversationId: "conv-3",
    inputTokens: 500,
    outputTokens: 250,
    totalTokens: 750,
    costUsd: 0.0225,
    timestamp: new Date("2026-03-02"),
  },
];

describe("Analytics Functions", () => {
  describe("calculateDailyStats", () => {
    it("should calculate daily statistics", () => {
      const stats = calculateDailyStats(mockEntries);

      expect(stats).toHaveLength(2);
      expect(stats[0].date).toBe("2026-03-01");
      expect(stats[0].totalCost).toBeCloseTo(0.0315, 4);
      expect(stats[0].totalTokens).toBe(4500);
      expect(stats[0].entries).toBe(2);
    });

    it("should handle empty array", () => {
      const stats = calculateDailyStats([]);
      expect(stats).toHaveLength(0);
    });

    it("should sort by date", () => {
      const stats = calculateDailyStats(mockEntries);
      expect(stats[0].date.localeCompare(stats[1].date)).toBeLessThanOrEqual(0);
    });

    it("should round cost to 4 decimals", () => {
      const stats = calculateDailyStats([
        {
          ...mockEntries[0],
          costUsd: 0.0000123456,
          timestamp: new Date("2026-03-03"),
        },
      ]);
      expect(stats[0].totalCost).toBe(0);
    });
  });

  describe("calculateProviderStats", () => {
    it("should calculate provider statistics", () => {
      const stats = calculateProviderStats(mockEntries);

      expect(stats).toHaveLength(2);

      const claude = stats.find(s => s.provider === "claude");
      expect(claude).toBeDefined();
      expect(claude!.totalTokens).toBe(4500);
      expect(claude!.entries).toBe(2);
      expect(claude!.models).toHaveLength(1);
    });

    it("should calculate model statistics", () => {
      const stats = calculateProviderStats(mockEntries);
      const claude = stats.find(s => s.provider === "claude")!;
      const model = claude.models[0];

      expect(model.model).toBe("claude-3-5-sonnet");
      expect(model.totalTokens).toBe(4500);
      expect(model.inputTokens).toBe(3000);
      expect(model.outputTokens).toBe(1500);
    });
  });

  describe("getTopConversations", () => {
    it("should return top conversations sorted by cost", () => {
      const conversations = getTopConversations(mockEntries);

      expect(conversations).toHaveLength(3);
      expect(conversations[0].totalCost).toBeGreaterThanOrEqual(conversations[1].totalCost);
    });

    it("should respect limit parameter", () => {
      const conversations = getTopConversations(mockEntries, 2);
      expect(conversations).toHaveLength(2);
    });
  });

  describe("forecastCosts", () => {
    it("should generate forecast", () => {
      const dailyStats = calculateDailyStats(mockEntries);
      const forecast = forecastCosts(dailyStats, 7);

      expect(forecast.length).toBeLessThanOrEqual(7);
      expect(forecast[0]).toHaveProperty("date");
      expect(forecast[0]).toHaveProperty("projected");
      expect(forecast[0]).toHaveProperty("trend");
    });

    it("should return empty array with insufficient data", () => {
      const forecast = forecastCosts([]);
      expect(forecast).toHaveLength(0);
    });

    it("should never produce negative projections", () => {
      const forecast = forecastCosts(
        [
          { date: "2026-03-01", totalCost: 10, totalTokens: 100, entries: 1 },
          { date: "2026-03-02", totalCost: 0, totalTokens: 100, entries: 1 },
        ],
        5,
      );
      expect(forecast.every(point => point.projected >= 0)).toBe(true);
    });
  });

  describe("generateRecommendations", () => {
    it("should generate recommendations", () => {
      const stats = calculateProviderStats(mockEntries);
      const recommendations = generateRecommendations(mockEntries, stats);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.every(r => r.priority)).toBe(true);
    });

    it("should prioritize high priority recommendations", () => {
      const stats = calculateProviderStats(mockEntries);
      const recommendations = generateRecommendations(mockEntries, stats);

      if (recommendations.length > 0) {
        const priorities = recommendations.map(r => r.priority);
        const highPriorityIndex = priorities.indexOf("high");
        const mediumPriorityIndex = priorities.indexOf("medium");

        if (highPriorityIndex !== -1 && mediumPriorityIndex !== -1) {
          expect(highPriorityIndex).toBeLessThan(mediumPriorityIndex);
        }
      }
    });
  });

  describe("calculateSummaryStats", () => {
    it("should calculate summary statistics", () => {
      const summary = calculateSummaryStats(mockEntries);

      expect(summary.totalCost).toBeCloseTo(0.054, 3);
      expect(summary.totalTokens).toBe(5250);
      expect(summary.totalInputTokens).toBe(3500);
      expect(summary.totalOutputTokens).toBe(1750);
      expect(summary.dayCount).toBeGreaterThan(0);
    });

    it("should calculate average daily cost", () => {
      const summary = calculateSummaryStats(mockEntries);
      expect(summary.avgDailyCost).toBeGreaterThan(0);
    });

    it("should calculate cost per token", () => {
      const summary = calculateSummaryStats(mockEntries);
      expect(summary.avgCostPerToken).toBeGreaterThan(0);
      expect(summary.avgCostPerToken).toBeLessThan(0.001);
    });

    it("should handle empty input safely", () => {
      const summary = calculateSummaryStats([]);
      expect(summary.totalEntries).toBe(0);
      expect(summary.dayCount).toBe(0);
      expect(summary.totalCost).toBe(0);
    });
  });
});
