import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  "features/approvals/approvals-client.tsx",
  "utf8",
);
const registrySource = readFileSync(
  "lib/extensions/registry.tsx",
  "utf8",
);

describe("approval BI board availability contract", () => {
  it("treats unavailable tenant-scoped BI readouts as a hidden optional panel", () => {
    expect(clientSource).toContain(
      'type BiBoardAccessState = "checking" | "available" | "unavailable"',
    );
    expect(clientSource).toContain(
      "function isExpectedBiBoardUnavailableStatus(status: number)",
    );
    // The `optional=1` query string is constructed by the extension registry
    // (lib/extensions/registry.tsx) when it builds the BiBoardContribution
    // shape for this workspace; the client only follows the URL it is given.
    expect(registrySource).toContain("&optional=1");
    expect(clientSource).toContain("payload.available === false");
    expect(clientSource).toContain("return status === 403 || status === 404;");
    expect(clientSource).toContain('setBiBoardAccessState("unavailable")');
    expect(clientSource).toContain('setBiBoardAccessState("available")');
    expect(clientSource).toContain(
      'biBoardAccessState === "available" && biBoardContribution ? (',
    );
    expect(clientSource).not.toContain("Failed to load BI board preview");
  });
});
