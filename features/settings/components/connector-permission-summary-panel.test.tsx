/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONNECTOR_PERMISSION_SUMMARIES } from "@/features/agentic-governance/connector-permission-summary";
import { ConnectorPermissionSummaryPanel } from "./connector-permission-summary-panel";

describe("ConnectorPermissionSummaryPanel", () => {
  it("renders the current connector permission contract as a read-only settings surface", () => {
    const { container } = render(
      <ConnectorPermissionSummaryPanel
        english={true}
        summaries={CONNECTOR_PERMISSION_SUMMARIES}
      />,
    );

    expect(screen.getByText("Connector permission summary")).toBeInTheDocument();
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("DingTalk")).toBeInTheDocument();
    expect(screen.getAllByText("Auto allowed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review required").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Never allowed").length).toBeGreaterThan(0);
    expect(screen.getByText("Read-only governance")).toBeInTheDocument();
    expect(container.querySelectorAll("button, a, input, select, textarea")).toHaveLength(0);
  });

  it("keeps boundary wording visible in Chinese", () => {
    render(
      <ConnectorPermissionSummaryPanel
        english={false}
        summaries={CONNECTOR_PERMISSION_SUMMARIES}
      />,
    );

    expect(screen.getByText("连接器权限摘要")).toBeInTheDocument();
    expect(screen.getByText("只读治理")).toBeInTheDocument();
    expect(screen.getByText(/这里不是连接器控制面/)).toBeInTheDocument();
    expect(screen.getByText(/客户可见发送、客户关系系统阶段写回/)).toBeInTheDocument();
    expect(screen.queryByText(/CRM 阶段写回/)).not.toBeInTheDocument();
  });
});
