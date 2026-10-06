import { describe, expect, it } from "vitest";
import { publishSuggestions } from "../src/suggestion_policy.js";

describe("publishSuggestions", () => {
  it("keeps the strongest complete answer once and respects the editor limit", () => {
    const result = publishSuggestions([
      { id: "release-pending", question: "Why pending?", answer: "Inspect checks.", area: "release", score: 0.82 },
      { id: "release-pending", question: "Why pending?", answer: "Inspect checks.", area: "release", score: 0.79 },
      { id: "build-cache", question: "Why a cache miss?", answer: "Compare digests.", area: "build", score: 0.91 },
      { id: "empty-answer", question: "What happened?", answer: " ", area: "diagnostics", score: 0.99 }
    ], 2);

    expect(result.map((entry) => entry.id)).toEqual(["build-cache", "release-pending"]);
  });
});
