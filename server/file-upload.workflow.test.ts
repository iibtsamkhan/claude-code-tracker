import { describe, expect, it } from "vitest";
import { usageImportInputSchema } from "@shared/usage";
import { parseHistoryFile } from "../client/src/lib/parsers";

describe("file upload and parsing workflow", () => {
  it("parses a claude file and produces valid import payload", () => {
    const content = JSON.stringify([
      {
        id: "conv-1",
        model: "claude-3-5-sonnet",
        timestamp: "2026-03-05T00:00:00Z",
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
      },
    ]);

    const parsed = parseHistoryFile(content, "claude-history.json");
    expect(parsed.success).toBe(true);

    const validation = usageImportInputSchema.safeParse({
      projectId: 1,
      entries: parsed.entries,
    });
    expect(validation.success).toBe(true);
  });

  it("fails parser for invalid payload", () => {
    const parsed = parseHistoryFile(JSON.stringify([{ invalid: true }]), "unknown.json");
    expect(parsed.success).toBe(false);
  });
});
