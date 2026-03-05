import { describe, expect, it } from "vitest";
import { assertNoThirdPartyEgress } from "./networkPolicy";

describe("network egress policy", () => {
  it("allows same-origin relative API URLs", () => {
    expect(() =>
      assertNoThirdPartyEgress("/api/trpc/usage.import", "https://tracker.example.com"),
    ).not.toThrow();
  });

  it("blocks absolute third-party URLs", () => {
    expect(() =>
      assertNoThirdPartyEgress("https://analytics.example.net/collect", "https://tracker.example.com"),
    ).toThrow(/Third-party egress blocked/);
  });
});
