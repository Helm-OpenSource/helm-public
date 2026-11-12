// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAccountSwitcher } from "./workspace-account-switcher";

const mocks = vi.hoisted(() => ({ choose: vi.fn(), error: vi.fn(), navigate: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ selectLoginWorkspaceAction: mocks.choose }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
const props = {
  workspaceId: "alpha", workspaceName: "Alpha", userName: "Alex", roleLabel: "成员", title: "Alpha", locale: "zh-CN" as const,
  options: [
    { workspaceId: "alpha", workspaceName: "Alpha", roleLabel: "成员", status: "ACTIVE" as const },
    { workspaceId: "beta", workspaceName: "Beta", roleLabel: "管理员", status: "ACTIVE" as const },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("location", { assign: mocks.navigate });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function chooseBeta() {
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  const option = await screen.findByRole("option", { name: /Beta/ });
  fireEvent.click(option);
}
describe("workspace account switcher", () => {
  it("keeps the current account visible and does not offer a menu for one membership", () => {
    render(<WorkspaceAccountSwitcher {...props} options={[props.options[0]]} />);
    expect(screen.getByText("Alex")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("shows accessible choices, roles and the current organization", async () => {
    render(<WorkspaceAccountSwitcher {...props} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "切换租户，当前：Alpha" }), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: /Alpha/ })).toBeTruthy();
    expect(screen.getByText("成员 · 当前租户")).toBeTruthy();
    expect(screen.getByText("管理员 · 已激活")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Alpha/ }));
    expect(mocks.choose).not.toHaveBeenCalled();
  });
  it("switches through the authenticated action then performs a full navigation to its landing page", async () => {
    mocks.choose.mockResolvedValue({ ok: true, redirectTo: "/workspace/home" });
    render(<WorkspaceAccountSwitcher {...props} />);
    await chooseBeta();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/workspace/home"));
    expect(mocks.choose).toHaveBeenCalledExactlyOnceWith({ workspaceId: "beta", locale: "zh-CN" });
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
  });
  it.each([
    { ok: false, error: "选择的组织当前不可用。" },
    new Error("网络连接失败"),
  ])("keeps the current organization and allows retry after a failure: %s", async (failure) => {
    if (failure instanceof Error) mocks.choose.mockRejectedValue(failure);
    else mocks.choose.mockResolvedValue(failure);
    render(<WorkspaceAccountSwitcher {...props} />);
    await chooseBeta();
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Alpha · 成员")).toBeTruthy();
    mocks.choose.mockResolvedValue({ ok: true, redirectTo: "/dashboard" });
    await chooseBeta();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/dashboard"));
  });
  it("prevents another choice while the switch request is pending", async () => {
    let finish!: (value: { ok: boolean; error: string }) => void;
    mocks.choose.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<WorkspaceAccountSwitcher {...props} />);
    await chooseBeta();
    expect(screen.getByRole("combobox").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
    expect(mocks.choose).toHaveBeenCalledTimes(1);
    finish({ ok: false, error: "Try again" });
    await waitFor(() => expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(false));
  });
});
