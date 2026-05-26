import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const searchPageSource = readFileSync("app/(workspace)/search/page.tsx", "utf8");

describe("Ask Helm search page degraded mode contract", () => {
  it("keeps Ask Helm renderable when object search is slow or unavailable", () => {
    expect(searchPageSource).toContain("resolveOptionalSearchReadModel");
    expect(searchPageSource).toContain("buildEmptySearchWorkspaceEntitiesResult");
    expect(searchPageSource).toContain("SearchReadModelStatus");
    expect(searchPageSource).toContain("search-read-model-degraded");
    expect(searchPageSource).toContain("searchDegraded={searchReadModel.degraded}");
    expect(searchPageSource).toContain("assembleAskHelmRuntimeContext");
    expect(searchPageSource).toContain("ask-helm-context-audit");
    expect(searchPageSource).not.toContain(
      "const results = await searchWorkspaceEntities(workspace.id, q);",
    );
  });
});
