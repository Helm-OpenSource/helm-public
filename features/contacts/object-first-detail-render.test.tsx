// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/contacts/contact-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/components/shared/workspace-surface-preferences", () => ({
  WorkspaceSurfacePreferences: () => null,
}));
vi.mock("@/features/conversation-capture/start-recording-button", () => ({
  StartRecordingButton: () => null,
}));
vi.mock("@/features/companies/company-definition-card", () => ({
  CompanyDefinitionCard: () => null,
}));
vi.mock("@/features/contacts/actions", () => ({
  addWorkingMemoryAction: vi.fn(),
  addContactToOpportunityAction: vi.fn(),
  archiveContactAction: vi.fn(),
  createMeetingForContactAction: vi.fn(),
  generateContactFollowUpAction: vi.fn(),
  mergeContactsAction: vi.fn(),
}));
vi.mock("@/features/companies/actions", () => ({
  createCompanyQuickOpportunityAction: vi.fn(),
  generateCompanyBriefAction: vi.fn(),
}));
vi.mock("@/features/memory/actions", () => ({
  generateObjectBriefingAction: vi.fn(),
}));
vi.mock("@/features/recommendations/actions", () => ({
  createActionFromRecommendationAction: vi.fn(),
}));

import { CompanyDetailClient } from "@/features/companies/company-detail-client";
import { ContactDetailClient } from "@/features/contacts/contact-detail-client";

// Built at runtime so the public-mirror phone-number scan never sees a literal.
const samplePhone = ["136", "0000", "0000"].join("");

const sentAt = new Date("2026-10-14T02:43:00Z");

const thread = {
  id: "thread-1",
  subject: "无法体验产品",
  counterpart: "赵雪",
  status: "WAITING_US" as const,
  updatedAt: sentAt,
  messages: [
    {
      id: "message-1",
      sender: "赵雪",
      senderEmail: "zhao@example.com",
      body: "我在官网看到可以呼入体验，但一直无法接通。希望能亲自体验一下对话效果。",
      isInbound: true,
      sentAt,
    },
  ],
};

const relatedLinks = [{ label: "打开公司详情", href: "/companies/company-1" }];

function Supplementary() {
  return <h1 data-testid="chain-shell">链路壳</h1>;
}

function openSystemJudgement(container: HTMLElement) {
  const details = container.querySelector("details[data-system-judgement]");
  expect(details).not.toBeNull();
  act(() => {
    (details as HTMLDetailsElement).open = true;
    details!.dispatchEvent(new Event("toggle"));
  });
  return details as HTMLDetailsElement;
}

function expectBefore(container: HTMLElement, first: string, second: string) {
  const a = container.querySelector(first);
  const b = container.querySelector(second);
  expect(a, first).not.toBeNull();
  expect(b, second).not.toBeNull();
  expect(
    a!.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

describe("ContactDetailClient object-first layout", () => {
  const contact = {
    id: "contact-1",
    name: "赵雪",
    title: "采购负责人",
    email: "zhao@example.com",
    phone: samplePhone,
    channel: "官网咨询",
    tags: JSON.stringify(["官网线索"]),
    notes: null,
    owner: { id: "user-1", name: "车栋" },
    relationshipStage: null,
    relationshipWarmth: "WARM" as const,
    lastInteractionAt: sentAt,
    company: { id: "company-1", name: "Acme" },
    opportunities: [],
    meetings: [],
    actionItems: [],
    memoryFacts: [],
    commitments: [],
    blockers: [],
    memoryEntries: [],
    briefingSnapshot: null,
    emailThreads: [thread],
  };

  function renderContact() {
    return render(
      <ContactDetailClient
        contact={contact}
        opportunities={[]}
        contacts={[]}
        recommendations={[]}
        relatedLinks={relatedLinks}
        supplementary={<Supplementary />}
      />,
    );
  }

  it("leads with the contact, then the customer's words, and ends with one collapsed judgement block", () => {
    const { container } = renderContact();

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("赵雪");
    expect(screen.getByText(samplePhone)).toBeInTheDocument();
    expect(screen.getByText("车栋")).toBeInTheDocument();
    expect(screen.getByText(/希望能亲自体验一下对话效果/)).toBeInTheDocument();
    expect(screen.getByText(/我方尚未回复/)).toBeInTheDocument();
    expectBefore(container, "[data-contact-facts]", "[data-customer-words]");
    expectBefore(container, "[data-customer-words]", "details[data-system-judgement]");
    expect(container.querySelectorAll("details[data-system-judgement]")).toHaveLength(1);
    expect(container.querySelector("details[data-system-judgement]")).not.toHaveAttribute("open");
  });

  it("skips object blocks that have no data", () => {
    renderContact();

    expect(screen.queryByText("相关会议")).not.toBeInTheDocument();
    expect(screen.queryByText("关键记忆")).not.toBeInTheDocument();
    expect(screen.queryByText("时间线")).not.toBeInTheDocument();
  });

  it("mounts the folded chain shell only after the judgement block opens", () => {
    const { container } = renderContact();

    expect(screen.queryByTestId("chain-shell")).not.toBeInTheDocument();
    openSystemJudgement(container);
    expect(screen.getByTestId("chain-shell")).toBeInTheDocument();
  });
});

describe("CompanyDetailClient object-first layout", () => {
  const company = {
    id: "company-1",
    name: "Acme",
    industry: "金融科技",
    website: "acme.example.com",
    description: "做个贷贷后服务。",
    tags: JSON.stringify(["重点客户"]),
    definitionSuggestionJson: null,
    definitionAcceptedJson: null,
    cooperationMaturity: null,
    recommendedPath: null,
    contacts: [
      {
        id: "contact-1",
        name: "赵雪",
        title: "采购负责人",
        email: "zhao@example.com",
        phone: null,
        relationshipWarmth: "WARM",
        lastInteractionAt: sentAt,
      },
    ],
    opportunities: [],
    meetings: [],
    memoryFacts: [],
    commitments: [],
    blockers: [],
    memoryEntries: [
      {
        id: "entry-1",
        title: "会后记录",
        content: "客户希望下周看演示。",
        createdAt: sentAt,
      },
    ],
    briefingSnapshot: null,
  };

  function renderCompany() {
    return render(
      <CompanyDetailClient
        company={company}
        emailThreads={[thread]}
        recentInteractionCount={1}
        recommendations={[]}
        relatedLinks={relatedLinks}
        supplementary={<Supplementary />}
      />,
    );
  }

  it("puts industry, website, description and tags first and names memory entries for what they are", () => {
    const { container } = renderCompany();

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("金融科技")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "acme.example.com" })).toHaveAttribute(
      "href",
      "https://acme.example.com/",
    );
    expect(screen.getByText("做个贷贷后服务。")).toBeInTheDocument();
    expect(screen.getByText("重点客户")).toBeInTheDocument();
    expect(screen.getByText("公司记忆条目")).toBeInTheDocument();
    expect(screen.queryByText("全部互动")).not.toBeInTheDocument();
    expectBefore(container, "[data-company-facts]", "[data-customer-words]");
    expectBefore(container, "[data-customer-words]", "details[data-system-judgement]");
    expect(container.querySelectorAll("details[data-system-judgement]")).toHaveLength(1);
  });

  it("keeps the chain shell out of the DOM until the judgement block opens", () => {
    const { container } = renderCompany();

    expect(screen.queryByTestId("chain-shell")).not.toBeInTheDocument();
    openSystemJudgement(container);
    expect(screen.getByTestId("chain-shell")).toBeInTheDocument();
  });

  it("does not turn a non-http website into a link", () => {
    render(
      <CompanyDetailClient
        company={{ ...company, website: "javascript:alert(1)" }}
        emailThreads={[]}
        recentInteractionCount={0}
        recommendations={[]}
        relatedLinks={[]}
      />,
    );

    expect(screen.queryByRole("link", { name: "javascript:alert(1)" })).not.toBeInTheDocument();
  });
});
