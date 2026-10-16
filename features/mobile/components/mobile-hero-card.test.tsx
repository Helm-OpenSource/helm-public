/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MobileHeroCard } from "./mobile-hero-card";
import type { MobileJudgementLoopModel, MustPushItem } from "../types";
import { containsUnsafeMobileCopy } from "../lib/mobile-judgement-loop";

// next/link stub
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const baseItem = (overrides: Partial<MustPushItem> = {}): MustPushItem => ({
  id: "item-001",
  type: "stalled_opportunity",
  title: "示例客户 · 年度采购 14 天未更新",
  reason: "风险 高风险 · 阶段 待推进 · 负责人 未指派",
  primaryAction: { label: "查看商机", href: "/opportunities/opp-001", mode: "open_object" },
  boundaryNote: { type: "suggestion_not_commitment", message: "建议恢复节奏，不承诺成交结果。" },
  outcomeCheckpoint: {
    label: "结果回收",
    dueHint: "72 小时内回看",
    expectedSignal: "机会是否恢复节奏、被降级或继续阻塞",
    reviewHref: "/approvals?source=mobile&itemId=item-001&posture=outcome_review",
    status: "not_collected",
  },
  severity: "high",
  score: 75,
  ...overrides,
});

const normalModel = (): MobileJudgementLoopModel => ({
  state: "normal",
  item: baseItem(),
  headline: "示例客户 · 年度采购 14 天未更新",
  subtext: "风险 高风险 · 阶段 待推进 · 负责人 未指派",
  evidence: {
    sourceHint: "机会台账 · 停滞机会",
    helmInterpretation: "风险 高风险 · 阶段 待推进 · 负责人 未指派",
  },
  actions: [
    { label: "进入复核", href: "/approvals?source=mobile&itemId=item-001", variant: "primary" },
    { label: "查看证据", href: "#mobile-evidence", variant: "secondary" },
  ],
});

const emptyModel = (): MobileJudgementLoopModel => ({
  state: "empty",
  item: null,
  headline: "暂无待处理事项",
  subtext: "当前没有需要处理的推进项。",
  evidence: null,
  actions: [],
});

const crossTenantModel = (): MobileJudgementLoopModel => ({
  state: "cross_tenant_denied",
  item: null,
  headline: "跨租户操作，超出当前授权范围",
  subtext: "该操作涉及当前工作区授权范围以外的资源，当前仅提供安全返回入口。",
  evidence: null,
  actions: [
    { label: "返回首页", href: "/mobile", variant: "primary" },
    { label: "返回工作区首页", href: "/dashboard", variant: "secondary" },
  ],
});

describe("MobileHeroCard — normal render", () => {
  it("renders state badge", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByTestId("mobile-hero-badge")).toBeTruthy();
  });

  it("renders headline", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByTestId("mobile-hero-headline").textContent).toBe("示例客户 · 年度采购 14 天未更新");
  });

  it("renders subtext", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByTestId("mobile-hero-subtext").textContent).toContain("负责人 未指派");
  });

  it("renders evidence section with id mobile-evidence", () => {
    render(<MobileHeroCard model={normalModel()} />);
    const evidence = document.getElementById("mobile-evidence");
    expect(evidence).not.toBeNull();
  });

  it("renders action links", () => {
    render(<MobileHeroCard model={normalModel()} />);
    const actions = screen.getByTestId("mobile-hero-actions");
    expect(actions).toBeTruthy();
    const links = actions.querySelectorAll("a");
    expect(links.length).toBe(2);
  });

  it("keeps the primary action readable against the accent background", () => {
    render(<MobileHeroCard model={normalModel()} />);

    const primary = screen.getByTestId("mobile-hero-action-primary");
    expect(primary).toHaveClass("theme-primary-action");
    expect(primary).toHaveClass("!text-[color:var(--accent-foreground)]");
  });
});

describe("MobileHeroCard — evidence labels", () => {
  it("shows 业务来源 label", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByText("业务来源")).toBeTruthy();
  });

  it("does not repeat the reason under a 推进原因 label", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.queryByText("推进原因")).toBeNull();
  });

  it("shows English labels when english=true", () => {
    render(<MobileHeroCard model={normalModel()} english />);
    expect(screen.getByText("Source")).toBeTruthy();
    expect(screen.queryByText("Why now")).toBeNull();
  });

  it("folds source, boundary and outcome into one collapsed system judgement block after the actions", () => {
    render(<MobileHeroCard model={normalModel()} />);
    const block = document.getElementById("mobile-evidence");
    expect(block?.tagName).toBe("DETAILS");
    expect(block).toHaveAttribute("data-system-judgement");
    expect(block).not.toHaveAttribute("open");
    expect(document.querySelectorAll("[data-system-judgement]")).toHaveLength(1);
    expect(block).toContainElement(screen.getByTestId("mobile-hero-boundary"));
    expect(block).toContainElement(screen.getByTestId("mobile-hero-outcome"));
    const actions = screen.getByTestId("mobile-hero-actions");
    expect(
      actions.compareDocumentPosition(block as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("folds the other items' boundary notes into the same block without duplicates", () => {
    render(
      <MobileHeroCard
        model={normalModel()}
        extraBoundaryNotes={[
          "可以准备跟进草稿，对外发送仍需复核。",
          "可以准备跟进草稿，对外发送仍需复核。",
          "建议恢复节奏，不承诺成交结果。",
        ]}
      />,
    );
    const others = screen.getByTestId("mobile-hero-other-boundaries");
    expect(others.querySelectorAll("li")).toHaveLength(1);
    expect(document.getElementById("mobile-evidence")).toContainElement(others);
  });

  it("renders sourceHint content", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByText("机会台账 · 停滞机会")).toBeTruthy();
  });
});

describe("MobileHeroCard — outcome checkpoint", () => {
  it("renders outcome checkpoint copy", () => {
    render(<MobileHeroCard model={normalModel()} />);

    expect(screen.getByTestId("mobile-hero-outcome")).toBeTruthy();
    expect(screen.getByText("结果回收")).toBeTruthy();
    expect(screen.getByText("72 小时内回看")).toBeTruthy();
    expect(screen.getByText(/机会是否恢复节奏/)).toBeTruthy();
  });

  it("renders English outcome checkpoint label", () => {
    render(<MobileHeroCard model={normalModel()} english />);

    expect(screen.getByText("Outcome check")).toBeTruthy();
  });
});

describe("MobileHeroCard — empty state", () => {
  it("does not render action links when actions is empty", () => {
    render(<MobileHeroCard model={emptyModel()} />);
    expect(screen.queryByTestId("mobile-hero-actions")).toBeNull();
  });

  it("does not render evidence section", () => {
    render(<MobileHeroCard model={emptyModel()} />);
    expect(document.getElementById("mobile-evidence")).toBeNull();
  });
});

describe("MobileHeroCard — cross_tenant_denied", () => {
  it("does not render evidence section", () => {
    render(<MobileHeroCard model={crossTenantModel()} />);
    expect(document.getElementById("mobile-evidence")).toBeNull();
  });

  it("does not render item title in output", () => {
    render(<MobileHeroCard model={crossTenantModel()} />);
    expect(screen.queryByText("示例客户 · 年度采购 14 天未更新")).toBeNull();
  });

  it("does not render item reason in output", () => {
    render(<MobileHeroCard model={crossTenantModel()} />);
    expect(screen.queryByText(/负责人 未指派/)).toBeNull();
  });

  it("renders safe navigation actions", () => {
    render(<MobileHeroCard model={crossTenantModel()} />);
    const actions = screen.getByTestId("mobile-hero-actions");
    const hrefs = Array.from(actions.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/mobile");
    expect(hrefs).toContain("/dashboard");
  });
});

describe("MobileHeroCard — action label safety", () => {
  it("no action label contains banned words (normal)", () => {
    render(<MobileHeroCard model={normalModel()} />);
    const links = document.querySelectorAll("[data-testid='mobile-hero-actions'] a");
    for (const link of Array.from(links)) {
      expect(containsUnsafeMobileCopy(link.textContent ?? "")).toBe(false);
    }
  });

  it("no action label contains banned words (cross_tenant_denied)", () => {
    render(<MobileHeroCard model={crossTenantModel()} />);
    const links = document.querySelectorAll("[data-testid='mobile-hero-actions'] a");
    for (const link of Array.from(links)) {
      expect(containsUnsafeMobileCopy(link.textContent ?? "")).toBe(false);
    }
  });
});
