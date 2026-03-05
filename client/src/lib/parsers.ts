/**
 * AI Provider History File Parsers
 * Handles parsing and validation of usage history files from different AI providers
 */

import type { AIProvider, UsageEntryInput } from "@shared/usage";

export type ParsedUsageEntry = UsageEntryInput;

export interface ParserResult {
  success: boolean;
  provider?: AIProvider;
  entries: ParsedUsageEntry[];
  error?: string;
  stats?: {
    totalEntries: number;
    dateRange: { start: Date; end: Date };
    totalTokens: number;
    totalCost: number;
  };
}

const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "claude-2.1": { input: 0.008, output: 0.024 },
  "claude-2": { input: 0.008, output: 0.024 },
  "claude-instant-1.2": { input: 0.0008, output: 0.0024 },
};

const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-pro": { input: 0.0005, output: 0.0015 },
  "gemini-1.5-pro": { input: 0.00075, output: 0.003 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
};

function getModelPrice(provider: AIProvider, model: string): { input: number; output: number } {
  const pricing = {
    claude: CLAUDE_PRICING,
    openai: OPENAI_PRICING,
    gemini: GEMINI_PRICING,
  }[provider];

  if (pricing[model]) {
    return pricing[model];
  }

  const modelLower = model.toLowerCase();
  for (const [key, value] of Object.entries(pricing)) {
    if (modelLower.includes(key.toLowerCase())) {
      return value;
    }
  }

  return { input: 0.001, output: 0.002 };
}

function safeNumber(value: unknown, fallback: number = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateCost(
  provider: AIProvider,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPrice(provider, model);
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
}

function buildStats(entries: ParsedUsageEntry[]): ParserResult["stats"] {
  const timestamps = entries.map(entry => entry.timestamp.getTime());
  return {
    totalEntries: entries.length,
    dateRange: {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    },
    totalTokens: entries.reduce((sum, entry) => sum + entry.totalTokens, 0),
    totalCost: entries.reduce((sum, entry) => sum + entry.costUsd, 0),
  };
}

export function parseClaudeHistory(fileContent: string): ParserResult {
  try {
    const data = JSON.parse(fileContent);
    if (!Array.isArray(data)) {
      return { success: false, entries: [], error: "Invalid Claude history format: expected array" };
    }

    const entries: ParsedUsageEntry[] = [];
    for (const conversation of data) {
      if (!conversation?.model || !conversation?.usage) continue;
      const timestamp = safeDate(conversation.timestamp || conversation.created_at);
      if (!timestamp) continue;

      const inputTokens = safeNumber(conversation.usage.inputTokens);
      const outputTokens = safeNumber(conversation.usage.outputTokens);
      const totalTokens = inputTokens + outputTokens;
      const costUsd = calculateCost("claude", conversation.model, inputTokens, outputTokens);

      entries.push({
        provider: "claude",
        model: conversation.model,
        conversationId: conversation.id || undefined,
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd,
        timestamp,
        metadata: {
          title: conversation.title,
          messages: Array.isArray(conversation.messages) ? conversation.messages.length : 0,
        },
      });
    }

    if (entries.length === 0) {
      return { success: false, entries: [], error: "No valid usage entries found in Claude history" };
    }

    return { success: true, provider: "claude", entries, stats: buildStats(entries) };
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: `Failed to parse Claude history: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function parseOpenAIHistory(fileContent: string): ParserResult {
  try {
    const data = JSON.parse(fileContent);
    if (!Array.isArray(data)) {
      return { success: false, entries: [], error: "Invalid OpenAI history format: expected array" };
    }

    const entries: ParsedUsageEntry[] = [];
    for (const item of data) {
      if (!item?.model) continue;
      const timestamp = safeDate(item.timestamp || item.created_at);
      if (!timestamp) continue;

      const inputTokens = safeNumber(item.prompt_tokens);
      const outputTokens = safeNumber(item.completion_tokens);
      const totalTokens = safeNumber(item.total_tokens, inputTokens + outputTokens) || inputTokens + outputTokens;
      const costUsd = calculateCost("openai", item.model, inputTokens, outputTokens);

      entries.push({
        provider: "openai",
        model: item.model,
        conversationId: item.conversation_id || undefined,
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd,
        timestamp,
        metadata: { requestId: item.request_id },
      });
    }

    if (entries.length === 0) {
      return { success: false, entries: [], error: "No valid usage entries found in OpenAI history" };
    }

    return { success: true, provider: "openai", entries, stats: buildStats(entries) };
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: `Failed to parse OpenAI history: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function parseGeminiHistory(fileContent: string): ParserResult {
  try {
    const data = JSON.parse(fileContent);
    if (!Array.isArray(data)) {
      return { success: false, entries: [], error: "Invalid Gemini history format: expected array" };
    }

    const entries: ParsedUsageEntry[] = [];
    for (const item of data) {
      if (!item?.model) continue;
      const timestamp = safeDate(item.timestamp || item.created_at);
      if (!timestamp) continue;

      const inputTokens = safeNumber(item.input_tokens);
      const outputTokens = safeNumber(item.output_tokens);
      const totalTokens = safeNumber(item.total_tokens, inputTokens + outputTokens) || inputTokens + outputTokens;
      const costUsd = calculateCost("gemini", item.model, inputTokens, outputTokens);

      entries.push({
        provider: "gemini",
        model: item.model,
        conversationId: item.conversation_id || undefined,
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd,
        timestamp,
        metadata: { requestId: item.request_id },
      });
    }

    if (entries.length === 0) {
      return { success: false, entries: [], error: "No valid usage entries found in Gemini history" };
    }

    return { success: true, provider: "gemini", entries, stats: buildStats(entries) };
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: `Failed to parse Gemini history: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function parseHistoryFile(fileContent: string, filename?: string): ParserResult {
  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.includes("claude")) return parseClaudeHistory(fileContent);
    if (lower.includes("openai")) return parseOpenAIHistory(fileContent);
    if (lower.includes("gemini")) return parseGeminiHistory(fileContent);
  }

  const claude = parseClaudeHistory(fileContent);
  if (claude.success) return claude;

  const openai = parseOpenAIHistory(fileContent);
  if (openai.success) return openai;

  const gemini = parseGeminiHistory(fileContent);
  if (gemini.success) return gemini;

  return {
    success: false,
    entries: [],
    error: `Unable to detect provider. Last error: ${gemini.error ?? openai.error ?? claude.error ?? "Unknown parser error"}`,
  };
}
