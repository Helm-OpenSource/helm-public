// check:caio-attention — structural gate for the CAIO operating attention module (lib/caio-attention, the
// page layer in features/caio-attention and the pages under app/(workspace)/caio/attention).
//   1. The module never touches the generic governed-task tables: attention cases live only in their own
//      tables, so closing one can never count as a business outcome.
//   2. Pages and page components never reach the database directly; case content is read only through the
//      authorized loader behind getCaioAttentionPageService().
//   3. Until the lifecycle service is bound, the page service is fail closed: no rows, no case, no command.
//   4. lib/caio-attention/capability.json equals the binding-derived close capability (1 bound, 0 unbound), and
//      the close chain's forms ship with it.
// Passing it is a structural statement, not a readiness or activation claim.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION,
  CAIO_ATTENTION_PAGE_SERVICE_BOUND,
  CAIO_ATTENTION_UNAVAILABLE_SERVICE,
  getCaioAttentionPageService,
} from "@/features/caio-attention/service";

const root = path.resolve(__dirname, "..");
const MODULE_DIRS = ["lib/caio-attention", "features/caio-attention", "app/(workspace)/caio/attention"];
const PAGE_LAYER_DIRS = MODULE_DIRS.slice(1);

function sourceFiles(relativeDir: string): string[] {
  const dir = path.join(root, relativeDir);
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(path.join(relativeDir, name));
    return /\.(ts|tsx)$/u.test(name) ? [path.join(relativeDir, name)] : [];
  });
}

const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

describe("check:caio-attention", () => {
  it("scans a non-empty module", () => {
    for (const dir of MODULE_DIRS) expect(sourceFiles(dir).length, dir).toBeGreaterThan(0);
  });

  it("never references the generic governed-task tables", () => {
    const forbidden = /\b(ActionItem|ApprovalTask|ExecutionReceipt|actionItem|approvalTask|executionReceipt)\b/u;
    const hits = MODULE_DIRS.flatMap(sourceFiles).filter((file) => forbidden.test(read(file)));
    expect(hits).toEqual([]);
  });

  it("keeps the page layer away from direct database access", () => {
    const forbidden = /from\s+"@\/lib\/db"|from\s+"[./]*lib\/db"|\bPrismaClient\b|\$queryRaw|\$executeRaw|\bdb\.[a-zA-Z]+\./u;
    const hits = PAGE_LAYER_DIRS.flatMap(sourceFiles).filter((file) => forbidden.test(read(file)));
    expect(hits).toEqual([]);
  });

  it("loads every attention page through the page service", () => {
    const pages = sourceFiles("app/(workspace)/caio/attention").filter((file) => file.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const page of pages) expect(read(page), page).toMatch(/getCaioAttentionPageService\(\)/u);
  });

  it("declares close capability exactly as the service binding allows, with the close-chain forms present", () => {
    const capability = JSON.parse(read("lib/caio-attention/capability.json")) as { schemaVersion?: unknown; closeCapabilityVersion?: unknown };
    expect(capability.schemaVersion).toBe("caio-attention-capability/v1");
    expect(CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION).toBe(CAIO_ATTENTION_PAGE_SERVICE_BOUND ? 1 : 0);
    expect(capability.closeCapabilityVersion).toBe(CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION);
    const detail = read("app/(workspace)/caio/attention/[caseId]/page.tsx");
    for (const marker of ['kind="disposition"', 'kind="review"', "CaioAttentionConfirmForm"]) expect(detail, marker).toContain(marker);
    expect(read("features/caio-attention/actions.ts")).toMatch(/getCaioAttentionPageService\(\)\.runCommand\(/u);
  });

  it("keeps the fallback stub closed, and uses it whenever the service is unbound", async () => {
    if (!CAIO_ATTENTION_PAGE_SERVICE_BOUND) expect(getCaioAttentionPageService()).toBe(CAIO_ATTENTION_UNAVAILABLE_SERVICE);
    const service = CAIO_ATTENTION_UNAVAILABLE_SERVICE;
    const viewer = { workspaceId: "w1", actor: { userId: "u1", sameWorkspace: true, active: true, role: "OWNER" as const, canReviewGovernedActions: true } };
    await expect(service.listCases({ viewer, scope: "queue", page: 1, pageSize: 20 })).resolves.toMatchObject({ items: [], total: 0 });
    await expect(service.loadCase({ viewer, caseId: "c1", sourcePage: "/test" })).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(service.runCommand({ viewer, caseId: "c1", op: "ack", expectedCommandVersion: 1, clientRequestId: "r1" }))
      .resolves.toEqual({ ok: false, reason: "service_unavailable" });
  });
});
