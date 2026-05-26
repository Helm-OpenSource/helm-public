/**
 * Tests for Ask Helm Input Component
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AskHelmInput } from "./ask-helm-input";

describe("AskHelmInput", () => {
  it("frames the mobile input as work-question and signal intake, not generic chat", () => {
    render(<AskHelmInput />);

    expect(
      screen.getByPlaceholderText("问经营问题，或上报客户 / 会议 / 交付 / 承诺 / 阻塞信号"),
    ).toBeInTheDocument();
    expect(screen.getByText("客户在等回复")).toBeInTheDocument();
    expect(screen.getByText("会议有新承诺")).toBeInTheDocument();
    expect(screen.getByText("交付遇到阻塞")).toBeInTheDocument();
    expect(screen.getByText(/工作信号会先进入人工确认/)).toBeInTheDocument();
  });

  it("keeps the English mobile intake boundary visible", () => {
    render(<AskHelmInput english />);

    expect(
      screen.getByPlaceholderText(
        "Ask work, or report customer / meeting / delivery / commitment / blocker signals",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Customer waiting")).toBeInTheDocument();
    expect(screen.getByText("Meeting promise")).toBeInTheDocument();
    expect(screen.getByText(/will not send, commit, or write CRM/)).toBeInTheDocument();
  });
});
