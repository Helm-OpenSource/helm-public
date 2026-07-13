import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const cardSource = readFileSync("features/implementation/change-packet-card.tsx", "utf8");
const queueSource = readFileSync("features/implementation/operation-suggestion-queue.tsx", "utf8");
const diagnosticsPageSource = readFileSync("app/(workspace)/diagnostics/page.tsx", "utf8");

describe("change-packet read-only surface contract", () => {
  it("exposes navigation without execution, approval, or mutation controls", () => {
    expect(cardSource).toContain("href={suggestion.href}");
    expect(cardSource).not.toMatch(/<button\b/i);
    expect(cardSource).not.toMatch(/<form\b/i);
    expect(cardSource).not.toContain("onClick=");
    expect(cardSource).not.toContain("use server");
  });

  it("keeps the boundary note and honest empty state ahead of provider data", () => {
    expect(queueSource).toContain("BOUNDARY_NOTE");
    expect(queueSource).toContain("suggestions.length === 0");
    expect(queueSource).toContain("resolveShellOperationSuggestions");
  });

  it("mounts the read-only queue under diagnostics without a new top-level route", () => {
    expect(diagnosticsPageSource).toContain("<OperationSuggestionQueue");
    expect(diagnosticsPageSource).toContain("workspace={workspace}");
  });
});
