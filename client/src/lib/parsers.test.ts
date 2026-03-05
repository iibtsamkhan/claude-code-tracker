import { describe, it, expect } from "vitest";
import { parseClaudeHistory, parseOpenAIHistory, parseGeminiHistory, parseHistoryFile } from "./parsers";

describe("Claude History Parser", () => {
  it("should parse valid Claude history", () => {
    const mockData = [
      {
        id: "conv-1",
        model: "claude-3-5-sonnet",
        title: "Test Conversation",
        timestamp: "2026-03-05T00:00:00Z",
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
        },
        messages: [{ role: "user", content: "test" }],
      },
    ];

    const result = parseClaudeHistory(JSON.stringify(mockData));

    expect(result.success).toBe(true);
    expect(result.provider).toBe("claude");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].totalTokens).toBe(1500);
    expect(result.entries[0].provider).toBe("claude");
  });

  it("should handle invalid JSON", () => {
    const result = parseClaudeHistory("invalid json");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should handle empty array", () => {
    const result = parseClaudeHistory(JSON.stringify([]));
    expect(result.success).toBe(false);
  });

  it("should calculate cost correctly", () => {
    const mockData = [
      {
        id: "conv-1",
        model: "claude-3-5-sonnet",
        timestamp: "2026-03-05T00:00:00Z",
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
        },
      },
    ];

    const result = parseClaudeHistory(JSON.stringify(mockData));
    const entry = result.entries[0];

    // claude-3-5-sonnet: input $0.003/1K, output $0.015/1K
    // (1000 * 0.003 + 500 * 0.015) / 1000 = 0.0105
    expect(entry.costUsd).toBeCloseTo(0.0105, 4);
  });

  it("should skip entries with invalid timestamp", () => {
    const mockData = [
      {
        id: "conv-1",
        model: "claude-3-5-sonnet",
        timestamp: "not-a-date",
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
        },
      },
    ];

    const result = parseClaudeHistory(JSON.stringify(mockData));
    expect(result.success).toBe(false);
    expect(result.entries).toHaveLength(0);
  });
});

describe("OpenAI History Parser", () => {
  it("should parse valid OpenAI history", () => {
    const mockData = [
      {
        model: "gpt-4",
        timestamp: "2026-03-05T00:00:00Z",
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
    ];

    const result = parseOpenAIHistory(JSON.stringify(mockData));

    expect(result.success).toBe(true);
    expect(result.provider).toBe("openai");
    expect(result.entries).toHaveLength(1);
  });

  it("should handle missing tokens", () => {
    const mockData = [
      {
        model: "gpt-4",
        timestamp: "2026-03-05T00:00:00Z",
      },
    ];

    const result = parseOpenAIHistory(JSON.stringify(mockData));

    expect(result.success).toBe(true);
    expect(result.entries[0].inputTokens).toBe(0);
    expect(result.entries[0].outputTokens).toBe(0);
  });

  it("should fallback pricing for unknown models", () => {
    const mockData = [
      {
        model: "gpt-future-9000",
        timestamp: "2026-03-05T00:00:00Z",
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
    ];

    const result = parseOpenAIHistory(JSON.stringify(mockData));
    expect(result.success).toBe(true);
    expect(result.entries[0].costUsd).toBeGreaterThan(0);
  });

  it("should normalize invalid token fields to 0", () => {
    const mockData = [
      {
        model: "gpt-4",
        timestamp: "2026-03-05T00:00:00Z",
        prompt_tokens: -10,
        completion_tokens: "bad-data",
      },
    ];

    const result = parseOpenAIHistory(JSON.stringify(mockData));
    expect(result.success).toBe(true);
    expect(result.entries[0].inputTokens).toBe(0);
    expect(result.entries[0].outputTokens).toBe(0);
  });
});

describe("Gemini History Parser", () => {
  it("should parse valid Gemini history", () => {
    const mockData = [
      {
        model: "gemini-pro",
        timestamp: "2026-03-05T00:00:00Z",
        input_tokens: 1000,
        output_tokens: 500,
      },
    ];

    const result = parseGeminiHistory(JSON.stringify(mockData));

    expect(result.success).toBe(true);
    expect(result.provider).toBe("gemini");
    expect(result.entries).toHaveLength(1);
  });

  it("should reject non-array payload", () => {
    const result = parseGeminiHistory(JSON.stringify({ bad: true }));
    expect(result.success).toBe(false);
  });
});

describe("Auto-detect Parser", () => {
  it("should detect Claude from filename", () => {
    const mockData = [
      {
        id: "conv-1",
        model: "claude-3-5-sonnet",
        timestamp: "2026-03-05T00:00:00Z",
        usage: { inputTokens: 100, outputTokens: 50 },
      },
    ];

    const result = parseHistoryFile(JSON.stringify(mockData), "claude-history.json");
    expect(result.provider).toBe("claude");
  });

  it("should detect OpenAI from filename", () => {
    const mockData = [
      {
        model: "gpt-4",
        timestamp: "2026-03-05T00:00:00Z",
        prompt_tokens: 100,
        completion_tokens: 50,
      },
    ];

    const result = parseHistoryFile(JSON.stringify(mockData), "openai-usage.json");
    expect(result.provider).toBe("openai");
  });

  it("should try all parsers if filename not recognized", () => {
    const mockData = [
      {
        id: "conv-1",
        model: "claude-3-5-sonnet",
        timestamp: "2026-03-05T00:00:00Z",
        usage: { inputTokens: 100, outputTokens: 50 },
      },
    ];

    const result = parseHistoryFile(JSON.stringify(mockData), "data.json");
    expect(result.success).toBe(true);
    expect(result.provider).toBe("claude");
  });

  it("should fail when provider cannot be detected", () => {
    const result = parseHistoryFile(JSON.stringify([{ hello: "world" }]), "random.json");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unable to detect provider");
  });
});
