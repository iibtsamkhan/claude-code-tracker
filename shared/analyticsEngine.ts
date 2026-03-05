export interface UsageAnalyticsEntry {
  id?: number;
  provider: "claude" | "openai" | "gemini";
  model: string;
  conversationId?: string;
  promptId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  projectId?: number | null;
}

export interface DailyStats {
  date: string;
  totalCost: number;
  totalTokens: number;
  entries: number;
}

export interface ProviderStats {
  provider: string;
  totalCost: number;
  totalTokens: number;
  entries: number;
  models: ModelStats[];
}

export interface ModelStats {
  model: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  entries: number;
  costPerToken: number;
}

export interface ConversationStats {
  conversationId: string;
  model: string;
  provider: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  timestamp: Date;
}

export interface ForecastData {
  date: string;
  projected: number;
  trend: number;
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  potentialSavings: number;
  priority: "high" | "medium" | "low";
}

const safeRound = (value: number, places: number) =>
  Math.round(value * Math.pow(10, places)) / Math.pow(10, places);

export function calculateDailyStats(entries: UsageAnalyticsEntry[]): DailyStats[] {
  const dailyMap = new Map<string, { cost: number; tokens: number; count: number }>();

  for (const entry of entries) {
    const date = entry.timestamp.toISOString().split("T")[0];
    const existing = dailyMap.get(date) ?? { cost: 0, tokens: 0, count: 0 };
    dailyMap.set(date, {
      cost: existing.cost + entry.costUsd,
      tokens: existing.tokens + entry.totalTokens,
      count: existing.count + 1,
    });
  }

  return Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      totalCost: safeRound(stats.cost, 4),
      totalTokens: stats.tokens,
      entries: stats.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateProviderStats(entries: UsageAnalyticsEntry[]): ProviderStats[] {
  const providerMap = new Map<
    string,
    Map<string, { cost: number; inputTokens: number; outputTokens: number; count: number }>
  >();

  for (const entry of entries) {
    if (!providerMap.has(entry.provider)) {
      providerMap.set(entry.provider, new Map());
    }

    const modelMap = providerMap.get(entry.provider)!;
    const existing = modelMap.get(entry.model) ?? {
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      count: 0,
    };

    modelMap.set(entry.model, {
      cost: existing.cost + entry.costUsd,
      inputTokens: existing.inputTokens + entry.inputTokens,
      outputTokens: existing.outputTokens + entry.outputTokens,
      count: existing.count + 1,
    });
  }

  return Array.from(providerMap.entries()).map(([provider, modelMap]) => {
    const models: ModelStats[] = Array.from(modelMap.entries()).map(([model, stats]) => {
      const totalTokens = stats.inputTokens + stats.outputTokens;
      return {
        model,
        totalCost: safeRound(stats.cost, 4),
        totalTokens,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        entries: stats.count,
        costPerToken: totalTokens > 0 ? safeRound(stats.cost / totalTokens, 8) : 0,
      };
    });

    const totalCost = models.reduce((sum, model) => sum + model.totalCost, 0);
    const totalTokens = models.reduce((sum, model) => sum + model.totalTokens, 0);
    const totalEntries = models.reduce((sum, model) => sum + model.entries, 0);

    return {
      provider,
      totalCost: safeRound(totalCost, 4),
      totalTokens,
      entries: totalEntries,
      models: models.sort((a, b) => b.totalCost - a.totalCost),
    };
  });
}

export function getTopConversations(
  entries: UsageAnalyticsEntry[],
  limit: number = 20,
): ConversationStats[] {
  const conversationMap = new Map<string, ConversationStats>();

  for (const entry of entries) {
    const key =
      entry.conversationId || `${entry.provider}-${entry.model}-${entry.timestamp.getTime()}`;
    const existing = conversationMap.get(key);

    if (existing) {
      existing.totalCost += entry.costUsd;
      existing.totalTokens += entry.totalTokens;
      existing.inputTokens += entry.inputTokens;
      existing.outputTokens += entry.outputTokens;
      continue;
    }

    conversationMap.set(key, {
      conversationId: key,
      model: entry.model,
      provider: entry.provider,
      totalCost: entry.costUsd,
      totalTokens: entry.totalTokens,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      timestamp: entry.timestamp,
    });
  }

  return Array.from(conversationMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit)
    .map(item => ({
      ...item,
      totalCost: safeRound(item.totalCost, 4),
    }));
}

export function forecastCosts(dailyStats: DailyStats[], forecastDays: number = 30): ForecastData[] {
  if (dailyStats.length < 2) {
    return [];
  }

  const n = dailyStats.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = dailyStats.map(day => day.totalCost);
  const xMean = x.reduce((sum, i) => sum + i, 0) / n;
  const yMean = y.reduce((sum, value) => sum + value, 0) / n;

  const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
  const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  const lastDate = new Date(dailyStats[n - 1].date);
  const forecast: ForecastData[] = [];

  for (let i = 1; i <= forecastDays; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    const projected = Math.max(0, intercept + slope * (n + i - 1));
    forecast.push({
      date: futureDate.toISOString().split("T")[0],
      projected: safeRound(projected, 4),
      trend: safeRound(slope, 6),
    });
  }

  return forecast;
}

export function generateRecommendations(
  entries: UsageAnalyticsEntry[],
  providerStats: ProviderStats[],
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const allModels = providerStats.flatMap(provider => provider.models);

  if (allModels.length > 1) {
    const expensiveModels = allModels.filter(model => model.costPerToken > 0.00001);
    const cheapestModel = allModels.reduce((min, model) =>
      model.costPerToken < min.costPerToken ? model : min,
    );

    const potentialSavings = expensiveModels.reduce((sum, model) => {
      const diff = model.costPerToken - cheapestModel.costPerToken;
      return sum + diff * model.totalTokens;
    }, 0);

    if (potentialSavings > 0) {
      recommendations.push({
        id: "use-cheaper-models",
        title: "Switch to More Affordable Models",
        description: `Consider using ${cheapestModel.model} more often to reduce spend from premium model usage.`,
        potentialSavings: safeRound(potentialSavings, 2),
        priority: "high",
      });
    }
  }

  const totalInputTokens = entries.reduce((sum, entry) => sum + entry.inputTokens, 0);
  const totalOutputTokens = entries.reduce((sum, entry) => sum + entry.outputTokens, 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const inputRatio = totalTokens > 0 ? totalInputTokens / totalTokens : 0;

  if (inputRatio > 0.7) {
    recommendations.push({
      id: "optimize-prompts",
      title: "Optimize Prompt Engineering",
      description: "Input token share is high. Tightening prompt length can reduce recurring cost.",
      potentialSavings: safeRound(totalInputTokens * 0.25 * 0.001, 2),
      priority: "medium",
    });
  }

  const dailyStats = calculateDailyStats(entries);
  if (dailyStats.length > 0) {
    const avgDailyCost = dailyStats.reduce((sum, day) => sum + day.totalCost, 0) / dailyStats.length;
    const highCostDays = dailyStats.filter(day => day.totalCost > avgDailyCost * 1.5).length;
    if (highCostDays > dailyStats.length * 0.2) {
      recommendations.push({
        id: "batch-processing",
        title: "Consider Batch Processing",
        description: "Spending spikes across multiple days suggest batching or queueing could lower costs.",
        potentialSavings: safeRound(avgDailyCost * dailyStats.length * 0.12, 2),
        priority: "low",
      });
    }
  }

  return recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export function calculateSummaryStats(entries: UsageAnalyticsEntry[]) {
  const totalCost = entries.reduce((sum, entry) => sum + entry.costUsd, 0);
  const totalTokens = entries.reduce((sum, entry) => sum + entry.totalTokens, 0);
  const totalInputTokens = entries.reduce((sum, entry) => sum + entry.inputTokens, 0);
  const totalOutputTokens = entries.reduce((sum, entry) => sum + entry.outputTokens, 0);

  if (entries.length === 0) {
    const now = new Date();
    return {
      totalCost: 0,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgCostPerToken: 0,
      dateRange: { start: now, end: now },
      dayCount: 0,
      avgDailyCost: 0,
      totalEntries: 0,
    };
  }

  const timestamps = entries.map(entry => entry.timestamp.getTime());
  const start = new Date(Math.min(...timestamps));
  const end = new Date(Math.max(...timestamps));
  const dayCount = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    totalCost: safeRound(totalCost, 4),
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    avgCostPerToken: totalTokens > 0 ? safeRound(totalCost / totalTokens, 8) : 0,
    dateRange: { start, end },
    dayCount,
    avgDailyCost: safeRound(totalCost / dayCount, 4),
    totalEntries: entries.length,
  };
}
