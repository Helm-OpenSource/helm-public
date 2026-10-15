// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    contact: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
    opportunity: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    emailThread: { findMany: vi.fn() },
    emailMessage: { findMany: vi.fn() },
    meetingNote: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/memory",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/features/memory/actions", () => ({
  correctMemoryAction: vi.fn(),
  correctMemoryFactAction: vi.fn(),
  deleteMemoryAction: vi.fn(),
  deleteMemoryFactAction: vi.fn(),
  generateObjectBriefingAction: vi.fn(),
  invalidateMemoryFactAction: vi.fn(),
  reviewMemoryDistillationCandidateAction: vi.fn(),
  resolveBlockerAction: vi.fn(),
  updateBlockerStatusAction: vi.fn(),
  updateCommitmentStatusAction: vi.fn(),
  verifyMemberSignalMemoryCandidateAction: vi.fn(),
}));
vi.mock("@/features/meetings/actions", () => ({
  acceptReflectionCarryForwardAction: vi.fn(),
  dismissReflectionCarryForwardAction: vi.fn(),
}));

import { MemoryClient } from "@/features/memory/memory-client";
import {
  MEMORY_FACT_CONTEXT_ID_LIMIT,
  attachMemoryFactContext,
} from "@/features/memory/queries";

type MemoryClientProps = ComponentProps<typeof MemoryClient>;

const at = new Date("2026-10-14T02:43:00Z");

function buildProps(overrides: Partial<MemoryClientProps> = {}): MemoryClientProps {
  return {
    query: "",
    objectLevel: "ALL",
    source: "ALL",
    entryContext: null,
    returnToApprovalId: null,
    objectType: null,
    objectId: null,
    permissions: {
      canExportMemory: true,
      canManageMemoryFacts: true,
      canManageRuntime: false,
      canReviewRuntime: false,
    },
    firstLoopModel: {
      memoryWriteBack: { status: "watch" },
    } as unknown as MemoryClientProps["firstLoopModel"],
    memoryEntries: [],
    memoryFacts: [
      {
        id: "fact-1",
        objectType: "CONTACT",
        objectId: "contact-1",
        factType: "PREFERENCE",
        title: "安全评审先行",
        content: "客户要求周五前完成安全评审。",
        confidence: 80,
        importance: 82,
        freshnessScore: 70,
        status: "ACTIVE",
        confirmedByUser: false,
        sourceType: "EMAIL_MESSAGE",
        sourceId: "message-1",
        updatedAt: at,
        createdAt: at,
        object: { name: "赵雪", href: "/contacts/contact-1" },
        objectState: "resolved",
        source: {
          kind: "EMAIL_MESSAGE",
          title: "安全评审",
          author: "赵雪",
          occurredAt: at,
          text: "我们需要在周五前看到安全评审结果，否则无法进入采购流程。",
          href: "/inbox/thread-1",
        },
      },
      {
        id: "fact-2",
        objectType: "COMPANY",
        objectId: "company-gone",
        factType: "RISK_SIGNAL",
        title: "预算未定",
        content: "预算还没批。",
        confidence: 60,
        importance: 50,
        freshnessScore: 40,
        status: "ACTIVE",
        confirmedByUser: false,
        sourceType: "CSV_IMPORT",
        sourceId: "row-9",
        updatedAt: new Date("2026-10-13T02:43:00Z"),
        createdAt: new Date("2026-10-13T02:43:00Z"),
        object: null,
        objectState: "missing",
        source: null,
      },
    ],
    commitments: [],
    blockers: [],
    corrections: [],
    auditLogs: [],
    externalMemoryRecords: [],
    reflectionCandidates: [],
    reflectionDecisions: [],
    distillationCandidates: [],
    distillationDecisions: [],
    memberSignalPending: [],
    memberSignalDecisions: [],
    ...overrides,
  };
}

describe("memory page object-first render", () => {
  it("shows the fact's object name and the source's original text, judgement folded last", () => {
    const { container } = render(<MemoryClient {...buildProps()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("客户记忆 · 2 条");
    const objectLink = screen.getByRole("link", { name: "赵雪" });
    expect(objectLink).toHaveAttribute("href", "/contacts/contact-1");
    expect(container.querySelector("[data-memory-fact-source-text]")).toHaveTextContent(
      "我们需要在周五前看到安全评审结果，否则无法进入采购流程。",
    );
    expect(screen.getByRole("link", { name: "打开来源" })).toHaveAttribute(
      "href",
      "/inbox/thread-1",
    );
    // The company was queried and is gone: its id with 「已删除」, no fake name.
    expect(container.querySelector('[data-memory-fact-object-state="missing"]')).toHaveTextContent(
      "company-gone已删除",
    );
    expect(container.querySelector('[data-memory-fact-source="UNRESOLVED"]')).not.toBeNull();

    expect(screen.queryByText("客户状态清单")).toBeNull();
    expect(screen.queryByText("时间线阅读方式")).toBeNull();
    expect(screen.queryByText("经营影响")).toBeNull();

    const blocks = container.querySelectorAll("details[data-system-judgement]");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).not.toHaveAttribute("open");
    const timeline = container.querySelector("#memory-work-timeline");
    expect(timeline).not.toBeNull();
    expect(
      timeline!.compareDocumentPosition(blocks[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No review candidates: no empty review disclosure either.
    expect(container.querySelector('[data-memory-review-candidates="true"]')).toBeNull();
  });

  it("tells an object beyond the lookup cap (未加载) apart from a deleted one (已删除)", async () => {
    const total = MEMORY_FACT_CONTEXT_ID_LIMIT + 1;
    const ids = Array.from({ length: total }, (_, index) => `contact-${index + 1}`);
    const deletedId = "contact-7";
    // The resolver gets one row per queried id except the deleted one.
    dbMock.contact.findMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => id !== deletedId)
          .map((id) => ({ id, name: `联系人 ${id}` })),
    );
    const base = Date.parse("2026-10-01T00:00:00Z");
    const facts = ids.map((id, index) => ({
      id: `fact-${index + 1}`,
      objectType: "CONTACT" as const,
      objectId: id,
      factType: "PREFERENCE",
      title: `事实 ${index + 1}`,
      content: `内容 ${index + 1}`,
      confidence: 60,
      importance: 50,
      freshnessScore: 50,
      status: "ACTIVE",
      confirmedByUser: false,
      sourceType: "USER_EDIT",
      sourceId: `edit-${index + 1}`,
      // The 501st and the deleted fact are the two newest, so both render
      // inside the first timeline page.
      updatedAt: new Date(
        id === `contact-${total}`
          ? base + 2 * 86_400_000
          : id === deletedId
            ? base + 86_400_000
            : base - index * 1000,
      ),
      createdAt: new Date(base),
    }));

    const withContext = await attachMemoryFactContext("workspace-1", facts);

    expect(dbMock.contact.findMany).toHaveBeenCalledTimes(1);
    expect(
      (dbMock.contact.findMany.mock.calls[0][0] as { where: { id: { in: string[] } } }).where.id
        .in,
    ).toHaveLength(MEMORY_FACT_CONTEXT_ID_LIMIT);
    expect(withContext[total - 1].objectState).toBe("not_loaded");
    expect(withContext[total - 1].object).toBeNull();
    expect(withContext[6].objectState).toBe("missing");
    expect(withContext[0]).toMatchObject({
      objectState: "resolved",
      object: { name: "联系人 contact-1", href: "/contacts/contact-1" },
    });

    const { container } = render(
      <MemoryClient {...buildProps({ memoryFacts: withContext })} />,
    );
    const notLoaded = container.querySelector('[data-memory-fact-object-state="not_loaded"]');
    expect(notLoaded).toHaveTextContent(`contact-${total}未加载`);
    expect(notLoaded).not.toHaveTextContent("已删除");
    expect(
      container.querySelector('[data-memory-fact-object-state="missing"]'),
    ).toHaveTextContent(`${deletedId}已删除`);
    expect(screen.getByRole("link", { name: "联系人 contact-1" })).toHaveAttribute(
      "href",
      "/contacts/contact-1",
    );
  });
});
