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
  title: "商机停滞超 14 天",
  reason: "该商机上次推进记录距今已超两周，存在丢单风险。",
  primaryAction: { label: "查看商机", href: "/opportunities/opp-001", mode: "open_object" },
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
  headline: "商机停滞超 14 天",
  subtext: "该商机上次推进记录距今已超两周，存在丢单风险。",
  evidence: {
    sourceHint: "机会台账 · 停滞机会",
    helmInterpretation: "该商机上次推进记录距今已超两周，存在丢单风险。",
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
    expect(screen.getByTestId("mobile-hero-headline").textContent).toBe("商机停滞超 14 天");
  });

  it("renders subtext", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByTestId("mobile-hero-subtext").textContent).toContain("丢单风险");
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

  it("shows 推进原因 label", () => {
    render(<MobileHeroCard model={normalModel()} />);
    expect(screen.getByText("推进原因")).toBeTruthy();
  });

  it("shows English labels when english=true", () => {
    render(<MobileHeroCard model={normalModel()} english />);
    expect(screen.getByText("Source")).toBeTruthy();
    expect(screen.getByText("Why now")).toBeTruthy();
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
    expect(screen.queryByText("商机停滞超 14 天")).toBeNull();
  });

  it("does not render item reason in output", () => {
    render(<MobileHeroCard model={crossTenantModel()} />);
    expect(screen.queryByText(/丢单风险/)).toBeNull();
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
