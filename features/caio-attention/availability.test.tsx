import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CaioAttentionRouteRule } from "@/lib/caio-attention/contracts";
import { registerCaioAttentionPack, resetCaioAttentionPackForTests } from "@/lib/caio-attention/registry";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "@/lib/caio-attention/schedule";

import { caioAttentionCopy } from "./copy";
import { resolveCaioAttentionNavigation } from "./navigation";
import { CAIO_ATTENTION_UNAVAILABLE_SERVICE, getCaioAttentionPageService, isCaioAttentionPageServiceAvailable } from "./service";
import type { CaioAttentionViewer } from "./service-contract";

// The real binding, with a database client that fails on any use: proves the default-off path never queries.
const touched = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: () => { touched.count += 1; throw new Error("database touched"); } }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/components/shared/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("./page-context", () => ({
  getCaioAttentionPageContext: async () => ({
    english: false,
    viewer: { workspaceId: "w1", actor: { userId: "u1", sameWorkspace: true, active: true, role: "OWNER", canReviewGovernedActions: true } },
  }),
}));

const rule: CaioAttentionRouteRule = {
  detectorId: "det-a", category: "business", primaryRoleKey: "lead", primaryFallbackRoleKeys: [], ccRoleKeys: [],
  escalationRoleKey: "result_owner", escalationFallbackRoleKey: "ws_owner", reviewerRoleKey: "result_owner",
  reviewerFallbackRoleKey: "ws_owner", compatibleRuleVersions: ["v1"], committedDue: "suggest",
};
const viewer = (role: "OWNER" | "ADMIN" | "OTHER"): CaioAttentionViewer => ({
  workspaceId: "w1", actor: { userId: "u1", sameWorkspace: true, active: true, role, canReviewGovernedActions: role !== "OTHER" },
});

afterEach(() => { resetCaioAttentionPackForTests(); touched.count = 0; });

describe("CAIO attention availability follows the runtime rule (bound AND a registered pack policy)", () => {
  it("without a pack: no navigation entry for anyone, the pages render the unavailable state, and nothing touches the database", async () => {
    expect(isCaioAttentionPageServiceAvailable()).toBe(false);
    expect(getCaioAttentionPageService()).toBe(CAIO_ATTENTION_UNAVAILABLE_SERVICE);
    for (const role of ["OWNER", "ADMIN", "OTHER"] as const) await expect(resolveCaioAttentionNavigation(viewer(role))).resolves.toBe(false);
    const copy = caioAttentionCopy(false);
    const { default: Queue } = await import("@/app/(workspace)/caio/attention/page");
    const { default: Mine } = await import("@/app/(workspace)/caio/attention/mine/page");
    expect(renderToStaticMarkup(await Queue({ searchParams: Promise.resolve({}) }))).toContain(copy.unavailable);
    expect(renderToStaticMarkup(await Mine({ searchParams: Promise.resolve({}) }))).toContain(copy.unavailable);
    const { default: Detail } = await import("@/app/(workspace)/caio/attention/[caseId]/page");
    await expect(Detail({ params: Promise.resolve({ caseId: "c1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(touched.count).toBe(0);
  });

  it("with a registered pack: the bound service serves the pages and OWNER / ADMIN see the entry without a query", async () => {
    registerCaioAttentionPack({ packId: "p", policy, rules: [rule] });
    expect(isCaioAttentionPageServiceAvailable()).toBe(true);
    expect(getCaioAttentionPageService()).not.toBe(CAIO_ATTENTION_UNAVAILABLE_SERVICE);
    await expect(resolveCaioAttentionNavigation(viewer("OWNER"))).resolves.toBe(true);
    await expect(resolveCaioAttentionNavigation(viewer("ADMIN"))).resolves.toBe(true);
    expect(touched.count).toBe(0);
  });
});
