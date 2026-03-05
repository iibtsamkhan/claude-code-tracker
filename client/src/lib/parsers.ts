/**
 * AI Provider History File Parsers
 * Handles parsing and validation of usage and conversation-export files
 * from Claude, OpenAI, and Gemini.
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

type JsonObject = Record<string, unknown>;

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

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function safeNumber(value: unknown, fallback: number = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return null;
    const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

function normalizeRootArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return null;

  const containerKeys = ["conversations", "items", "data", "history", "chats"];
  for (const key of containerKeys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }

  return null;
}

function extractTextPayload(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(extractTextPayload).join(" ").trim();
  }
  if (isObject(value)) {
    const direct = firstString(value.text, value.content);
    if (direct) return direct;

    const parts = readPath(value, ["parts"]);
    if (Array.isArray(parts)) {
      const text = parts.map(extractTextPayload).join(" ").trim();
      if (text) return text;
    }

    const nestedContent = readPath(value, ["content", "parts"]);
    if (Array.isArray(nestedContent)) {
      const text = nestedContent.map(extractTextPayload).join(" ").trim();
      if (text) return text;
    }
  }

  return "";
}

function estimateTokensFromText(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
}

function extractMessageArray(item: JsonObject): unknown[] {
  const directArrays = [
    item.messages,
    item.chat_messages,
    item.turns,
    item.contents,
    item.events,
  ];
  for (const candidate of directArrays) {
    if (Array.isArray(candidate)) return candidate;
  }

  const mapping = item.mapping;
  if (isObject(mapping)) {
    return Object.values(mapping);
  }

  return [];
}

function estimateTokensFromMessages(item: JsonObject): {
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  let messageCount = 0;

  const messages = extractMessageArray(item);
  for (const raw of messages) {
    if (!isObject(raw)) continue;

    const role = firstString(
      raw.role,
      raw.sender,
      readPath(raw, ["author", "role"]),
      readPath(raw, ["message", "author", "role"]),
    )?.toLowerCase();

    const text = extractTextPayload(
      readPath(raw, ["message", "content"]) ??
        raw.content ??
        raw.text ??
        readPath(raw, ["parts"]) ??
        readPath(raw, ["content", "parts"]),
    );
    const tokens = estimateTokensFromText(text);

    if (tokens <= 0) continue;
    messageCount += 1;

    if (role === "assistant" || role === "model" || role === "claude") {
      outputTokens += tokens;
    } else {
      inputTokens += tokens;
    }
  }

  return { inputTokens, outputTokens, messageCount };
}

function readTokenUsage(item: JsonObject): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const inputTokens = safeNumber(
    firstNonNull(
      item.inputTokens,
      item.input_tokens,
      item.prompt_tokens,
      readPath(item, ["usage", "inputTokens"]),
      readPath(item, ["usage", "input_tokens"]),
      readPath(item, ["usage", "prompt_tokens"]),
      readPath(item, ["usageMetadata", "promptTokenCount"]),
    ),
    0,
  );

  const outputTokens = safeNumber(
    firstNonNull(
      item.outputTokens,
      item.output_tokens,
      item.completion_tokens,
      readPath(item, ["usage", "outputTokens"]),
      readPath(item, ["usage", "output_tokens"]),
      readPath(item, ["usage", "completion_tokens"]),
      readPath(item, ["usageMetadata", "candidatesTokenCount"]),
    ),
    0,
  );

  const totalTokens =
    safeNumber(
      firstNonNull(
        item.totalTokens,
        item.total_tokens,
        readPath(item, ["usage", "totalTokens"]),
        readPath(item, ["usage", "total_tokens"]),
        readPath(item, ["usageMetadata", "totalTokenCount"]),
      ),
      inputTokens + outputTokens,
    ) || inputTokens + outputTokens;

  return { inputTokens, outputTokens, totalTokens };
}

function firstNonNull(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function hasProviderSignal(provider: AIProvider, item: JsonObject, model: string): boolean {
  const modelLower = model.toLowerCase();
  if (provider === "claude") {
    return (
      modelLower.includes("claude") ||
      Array.isArray(item.chat_messages) ||
      firstString(item.anthropic_id, item.claude_id) !== undefined
    );
  }
  if (provider === "openai") {
    return (
      modelLower.includes("gpt") ||
      item.prompt_tokens !== undefined ||
      item.completion_tokens !== undefined ||
      isObject(item.mapping) ||
      firstString(item.request_id) !== undefined
    );
  }
  return (
    modelLower.includes("gemini") ||
    item.input_tokens !== undefined ||
    item.output_tokens !== undefined ||
    readPath(item, ["usageMetadata", "promptTokenCount"]) !== undefined ||
    readPath(item, ["usageMetadata", "candidatesTokenCount"]) !== undefined ||
    Array.isArray(item.contents)
  );
}

function parseProviderHistory(fileContent: string, provider: AIProvider): ParserResult {
  try {
    const raw = JSON.parse(fileContent);
    const data = normalizeRootArray(raw);
    if (!data) {
      return {
        success: false,
        entries: [],
        error: `Invalid ${provider} history format: expected array or object with conversations/items/data`,
      };
    }

    const entries: ParsedUsageEntry[] = [];

    for (const row of data) {
      if (!isObject(row)) continue;

      const timestamp = safeDate(
        firstNonNull(
          row.timestamp,
          row.created_at,
          row.createdAt,
          row.updated_at,
          row.updatedAt,
          row.create_time,
          row.update_time,
        ),
      );
      if (!timestamp) continue;

      const inferredModel = firstString(
        row.model,
        row.model_name,
        row.model_slug,
        readPath(row, ["metadata", "model"]),
        provider === "claude"
          ? "claude-3-5-sonnet"
          : provider === "openai"
            ? "gpt-4o-mini"
            : "gemini-1.5-flash",
      )!;

      if (!hasProviderSignal(provider, row, inferredModel)) continue;

      let { inputTokens, outputTokens, totalTokens } = readTokenUsage(row);
      let estimatedFromMessages = false;
      const messageEstimate = estimateTokensFromMessages(row);

      if (inputTokens + outputTokens <= 0 && messageEstimate.inputTokens + messageEstimate.outputTokens > 0) {
        inputTokens = messageEstimate.inputTokens;
        outputTokens = messageEstimate.outputTokens;
        totalTokens = inputTokens + outputTokens;
        estimatedFromMessages = true;
      }

      const conversationId = firstString(row.id, row.uuid, row.conversation_id, row.conversationId);
      const promptId = firstString(row.prompt_id, row.promptId, row.request_id);
      const costUsd = calculateCost(provider, inferredModel, inputTokens, outputTokens);

      entries.push({
        provider,
        model: inferredModel,
        conversationId,
        promptId,
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd,
        timestamp,
        metadata: {
          title: firstString(row.title, row.name),
          estimatedFromMessages,
          messageCount: messageEstimate.messageCount,
        },
      });
    }

    if (entries.length === 0) {
      return {
        success: false,
        entries: [],
        error: `No valid usage entries found in ${provider} history`,
      };
    }

    return {
      success: true,
      provider,
      entries,
      stats: buildStats(entries),
    };
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: `Failed to parse ${provider} history: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function parseClaudeHistory(fileContent: string): ParserResult {
  return parseProviderHistory(fileContent, "claude");
}

export function parseOpenAIHistory(fileContent: string): ParserResult {
  return parseProviderHistory(fileContent, "openai");
}

export function parseGeminiHistory(fileContent: string): ParserResult {
  return parseProviderHistory(fileContent, "gemini");
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
    error:
      "Unable to detect provider or parse usage entries. Use Claude/OpenAI/Gemini usage export JSON, or include provider name in filename (claude/openai/gemini).",
  };
}
