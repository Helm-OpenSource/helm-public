import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CaioAttentionCaseView, CaioAttentionLoadResult } from "./service-contract";

const loadCase = vi.fn<() => Promise<CaioAttentionLoadResult>>();
const listCases = vi.fn();

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/shared/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("./page-context", () => ({
  getCaioAttentionPageContext: async () => ({
    english: false,
    viewer: { workspaceId: "w1", actor: { userId: "u9", sameWorkspace: true, active: true, role: "OTHER", canReviewGovernedActions: false } },
  }),
}));
vi.mock("./service", () => ({
  CAIO_ATTENTION_PAGE_SERVICE_BOUND: true,
  getCaioAttentionPageService: () => ({ loadCase, listCases, runCommand: vi.fn() }),
}));

const people = { primaryUserId: "u1", ccUserIds: ["u2"], escalationUserId: "u3", reviewerUserIds: ["u4"], committedDueAt: new Date("2026-11-04T12:00:00.000Z") };
const view = (overrides: Partial<CaioAttentionCaseView>): CaioAttentionCaseView => ({
  caseId: "c1", shortNo: 7, status: "DISPATCHED", category: "business", severityAtSuggest: "warning", effectiveSeverity: "critical",
  detectorId: "detector-a", objectKey: "object-a", enterpriseSlug: null, createdAt: new Date("2026-11-04T01:00:00.000Z"),
  dispatchedAt: new Date("2026-11-04T02:00:00.000Z"), deferredUntil: null, closedAt: null, commandVersion: 1, reviewerVersion: 0,
  routingBlocked: false, routingBlockedReasons: [], prefill: people, command: { ...people, primaryUserId: "u5" },
  people: { u1: "Member One", u5: "Member Five" }, assignableUserIds: [], allowedOperations: [], viewerRoles: [],
  currentDisposition: null, dispositions: [], reviews: [], events: [], ...overrides,
});

async function renderDetail() {
  const { default: Page } = await import("@/app/(workspace)/caio/attention/[caseId]/page");
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ caseId: "c1" }) }));
}

describe("attention case page", () => {
  beforeEach(() => loadCase.mockReset());

  it("gives a refused viewer the same not-found as a missing case", async () => {
    loadCase.mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(renderDetail()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the confirmed command with its changes from the prefill and no forms without allowed operations", async () => {
    loadCase.mockResolvedValue({ ok: true, view: view({}) });
    const html = await renderDetail();
    expect(html).toContain("与预填的差异");
    expect(html).toContain("Member One → Member Five");
    expect(html).not.toContain("caio-attention-next-steps");
  });

  it("renders only the forms the loader allows", async () => {
    loadCase.mockResolvedValue({ ok: true, view: view({ allowedOperations: ["ack", "note", "submitDisposition"], viewerRoles: ["primary"] }) });
    const html = await renderDetail();
    for (const form of ["ack", "note", "disposition"]) expect(html).toContain(`caio-attention-${form}-form`);
    expect(html).not.toContain("caio-attention-review-form");
    expect(html).not.toContain("caio-attention-confirm-form");
  });

  it("asks the reviewer to tick external evidence only, and shows the prefill before confirmation", async () => {
    const disposition = { id: "d1", commandVersion: 1, sequence: 1, submittedByUserId: "u1", disposedAt: new Date("2026-11-04T03:00:00.000Z"),
      outcome: "handled", actionTaken: "fixed", note: null, evidenceRefs: ["audit-log:a1", "ticket:T-9"], superseded: false };
    loadCase.mockResolvedValue({ ok: true, view: view({ status: "DISPOSITION_SUBMITTED", allowedOperations: ["reviewAccept", "reviewReturn"], currentDisposition: disposition, dispositions: [disposition] }) });
    const review = await renderDetail();
    expect(review).toContain('value="ticket:T-9"');
    expect(review).not.toContain('value="audit-log:a1"');

    loadCase.mockResolvedValue({ ok: true, view: view({ status: "SUGGESTED", command: null, allowedOperations: ["confirm"], assignableUserIds: ["u1", "u5"] }) });
    const confirm = await renderDetail();
    expect(confirm).toContain("系统预填（仅建议）");
    expect(confirm).toContain("caio-attention-confirm-form");
  });
});
