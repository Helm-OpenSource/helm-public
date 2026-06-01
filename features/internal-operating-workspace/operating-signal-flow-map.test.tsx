/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  buildOperatingSignalFlowDisplay,
  OperatingSignalFlowMap,
} from "@/features/internal-operating-workspace/operating-signal-flow-map";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("OperatingSignalFlowMap", () => {
  it("builds the fixture-backed display model without runtime data", () => {
    const display = buildOperatingSignalFlowDisplay("zh-CN");

    expect(display.stats.find((item) => item.label === "客户资产")?.value).toBe(15);
    expect(display.stats.find((item) => item.label === "信号类型")?.value).toBe(7);
    expect(display.stats.find((item) => item.label === "待处理")?.value).toBe(10);
    expect(display.stats.find((item) => item.label === "需拍板")?.value).toBe(1);
    expect(display.aiPosture).toContainEqual({ label: "AI 排序权", value: "0" });
    expect(display.aiPosture).toContainEqual({ label: "跨客户动作", value: "0" });
    expect(display.journey.summaryItems.map((item) => item.label)).toEqual([
      "客户材料",
      "客户/机会",
      "经营信号",
      "下一步",
    ]);
    expect(display.journey.steps).toHaveLength(11);
    expect(display.journey.steps[0]?.source).toBe("Nimbus 安全评审同步会");
    expect(display.lifecycle.phases).toHaveLength(6);
    expect(display.lifecycle.branches).toHaveLength(4);
    expect(display.lifecycle.familyEvolution).toHaveLength(7);
    expect(display.lifecycle.familyEvolution.map((item) => item.objectSummary).join(" / ")).toContain("Beacon");
    expect(display.lifecycle.familyEvolution.map((item) => item.objectSummary).join(" / ")).toContain("Aya Nakamura");
    expect(display.lifecycle.autoLineDetail).toContain("不外发");
    expect(display.selectedPressure?.href).toMatch(
      /^\/operating\/signals\/boundary%3Aalias-f/u,
    );
    expect(display.selectedPressure?.handoffHref).toBe("/approvals");
    expect(display.stages.map((item) => item.id)).toEqual([
      "source",
      "collector",
      "gate",
      "object",
      "judgement",
      "review",
      "learning",
    ]);
  });

  it("renders the Chinese first-screen signal flow map with boundary visible", () => {
    const { container } = render(<OperatingSignalFlowMap locale="zh-CN" />);
    const map = container.querySelector("[data-operating-signal-flow-map='true']");

    expect(map).toBeInTheDocument();
    expect(map).toHaveAttribute("data-posture", "fixture");
    expect(map).toHaveAttribute("data-animation-policy", "disabled");
    expect(screen.getAllByText("客户经营资产").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("只读复核").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("先判断这条客户动作")).toBeInTheDocument();
    const summaryNote = screen.getByLabelText("摘要附注");
    expect(summaryNote).toBeInTheDocument();
    expect(summaryNote).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/把 Nimbus、Beacon、GreenPeak/)).not.toBeInTheDocument();
    fireEvent.click(summaryNote);
    expect(summaryNote).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/把 Nimbus、Beacon、GreenPeak/)).toBeInTheDocument();
    expect(screen.getByLabelText("只读附注")).toBeInTheDocument();
    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "今天最高压力",
    );
    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "Acme 试点承诺型外发草稿",
    );
    expect(screen.getByTestId("signal-flow-primary-safety-labels")).toHaveTextContent("仅供判断");
    expect(screen.getByTestId("signal-flow-primary-safety-labels")).toHaveTextContent("未外发");
    expect(screen.getByTestId("signal-flow-primary-safety-labels")).toHaveTextContent("需人工复核");
    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "谨慎动作",
    );
    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "停住原因",
    );
    expect(screen.getByTestId("signal-flow-boundary")).toBeInTheDocument();
    expect(screen.getByLabelText("保护线附注")).toBeInTheDocument();
    expect(screen.getByTestId("signal-flow-family-evolution")).toHaveTextContent(
      "按信号类型看客户资产",
    );
    const familyDetails = screen.getByTestId("signal-flow-family-evolution-details");
    expect(familyDetails).not.toHaveAttribute("open");
    expect(screen.getAllByTestId("signal-flow-family-row")[0]).not.toBeVisible();
    const assetEvolutionNote = screen.getByLabelText("资产演进附注");
    fireEvent.click(assetEvolutionNote);
    expect(assetEvolutionNote).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/把承诺、证据缺口/)).toBeInTheDocument();
    expect(familyDetails).not.toHaveAttribute("open");
    fireEvent.click(within(familyDetails).getByText("按信号类型看客户资产"));
    expect(familyDetails).toHaveAttribute("open");
    expect(screen.getByTestId("signal-flow-family-evolution")).toHaveTextContent("Nimbus");
    expect(screen.getByTestId("signal-flow-family-evolution")).toHaveTextContent("Beacon");
    expect(screen.getByTestId("signal-flow-family-evolution")).toHaveTextContent("Aya Nakamura");
    expect(screen.getByTestId("signal-flow-family-evolution").querySelectorAll("[data-testid='signal-flow-family-row']")).toHaveLength(7);
    expect(screen.getByTestId("signal-flow-process-spine").children).toHaveLength(6);
    expect(screen.getByTestId("signal-flow-lifecycle-graph")).toHaveTextContent(
      "经营过程",
    );
    expect(screen.getByTestId("signal-flow-control-layer")).not.toHaveTextContent("最高压力");
    expect(screen.getByTestId("signal-flow-control-layer")).toHaveTextContent("其他压力");
    expect(screen.getByTestId("signal-flow-control-paths")).not.toHaveAttribute("open");
    expect(screen.getByTestId("signal-flow-process-section")).not.toHaveAttribute("open");
    expect(screen.getByTestId("signal-flow-lifecycle-graph")).not.toHaveTextContent(
      "第 1 步",
    );
    expect(screen.getByTestId("signal-flow-process-spine")).toHaveTextContent("客户信息进来");
    expect(screen.getByTestId("signal-flow-process-spine")).toHaveTextContent("回执入账");
    expect(container.querySelectorAll(".signal-flow-pressure-row")).toHaveLength(3);
  });

  it("renders safe review-only actions", () => {
    render(<OperatingSignalFlowMap locale="en-US" />);

    const actions = screen.getByTestId("signal-flow-actions");
    const links = within(actions).getAllByRole("link");
    const firstLink = links[0]!;
    expect(links).toHaveLength(1);
    expect(firstLink).toHaveAttribute(
      "href",
      "/operating/signals/boundary%3Aalias-f?source=operating-map",
    );
    expect(firstLink.textContent).toMatch(/Open signal lifecycle/);
    expect(firstLink.textContent).not.toMatch(/send|approve|execute|write/i);
  });

  it("keeps the default layer customer-asset-first instead of product-mechanics-first", () => {
    const { container } = render(<OperatingSignalFlowMap locale="zh-CN" />);
    const map = container.querySelector("[data-operating-signal-flow-map='true']");

    expect(map).toBeInTheDocument();
    const visibleText = map?.textContent ?? "";

    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "Acme 试点承诺型外发草稿",
    );
    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "外部动作需拍板",
    );
    expect(screen.getByTestId("signal-flow-business-summary")).toHaveTextContent(
      "证据 2/2",
    );
    expect(screen.getByTestId("signal-flow-control-posture")).toHaveTextContent(
      "停在人工复核",
    );
    expect(screen.getByTestId("signal-flow-control-layer")).not.toHaveTextContent(
      "最高压力",
    );

    expect(visibleText).not.toMatch(
      /ActionItem|ApprovalTask|AuditLog|runtime shadow|operator queue|workflow|review_required|LLM final/i,
    );
    expect(screen.queryByText(/fixture/iu)).not.toBeInTheDocument();
  });
});
