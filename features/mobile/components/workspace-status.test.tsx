/**
 * Tests for Workspace Status Component
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceStatus } from "./workspace-status";

describe("WorkspaceStatus", () => {
  it("should display workspace name and today summary", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "今天先处理星河连锁恢复单，另有 2 项需要复核。",
      topAlert: null,
      reviewCount: 2,
    };

    render(<WorkspaceStatus status={status} />);

    expect(screen.getByText("Demo Workspace")).toBeInTheDocument();
    expect(screen.getByText(/今天先处理星河连锁恢复单/)).toBeInTheDocument();
  });

  it("should display top alert when present", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "测试摘要",
      topAlert: "1 项紧急",
      reviewCount: 0,
    };

    render(<WorkspaceStatus status={status} />);

    expect(screen.getByText("1 项紧急")).toBeInTheDocument();
  });

  it("should display review count when > 0", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "测试摘要",
      topAlert: null,
      reviewCount: 3,
    };

    render(<WorkspaceStatus status={status} />);

    expect(screen.getByText(/3.*待复核/)).toBeInTheDocument();
  });

  it("should display outcome checkpoint count when present", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "测试摘要",
      topAlert: null,
      reviewCount: 0,
      outcomeCheckpointCount: 4,
    };

    render(<WorkspaceStatus status={status} />);

    expect(screen.getByText(/4.*结果/)).toBeInTheDocument();
  });

  it("should display english labels when english=true", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "Process Xinghe recovery first, 2 reviews pending.",
      topAlert: null,
      reviewCount: 2,
      outcomeCheckpointCount: 1,
    };

    render(<WorkspaceStatus status={status} english={true} />);

    expect(screen.getByText("2 review")).toBeInTheDocument();
    expect(screen.getByText("1 outcome")).toBeInTheDocument();
  });

  it("should not display alert badge when topAlert is null", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "测试摘要",
      topAlert: null,
      reviewCount: 0,
    };

    const { container } = render(<WorkspaceStatus status={status} />);

    // Check that no danger badge is rendered
    const redBadges = container.querySelectorAll(
      '[class*="--status-danger-bg"]',
    );
    expect(redBadges.length).toBe(0);
  });

  it("should not display review badge when reviewCount is 0", () => {
    const status = {
      workspaceName: "Demo Workspace",
      todaySummary: "测试摘要",
      topAlert: null,
      reviewCount: 0,
    };

    const { container } = render(<WorkspaceStatus status={status} />);

    // Check that no warning badge is rendered
    const amberBadges = container.querySelectorAll(
      '[class*="--status-warning-bg"]',
    );
    expect(amberBadges.length).toBe(0);
  });
});
