// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MemberActivationPanel } from "./member-activation-panel";
vi.mock("./member-activation-actions", () => ({ consumeMemberActivationAction: vi.fn() }));
it("removes bearer token from the URL without rendering it or consuming on GET", async () => {
  const { consumeMemberActivationAction } = await import("./member-activation-actions");
  const token = "a".repeat(43);
  window.history.replaceState(null, "", `/activate-member#token=${token}`);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemberActivationPanel />));
  expect(window.location.hash).toBe("");
  expect(container.textContent).not.toContain(token);
  expect(consumeMemberActivationAction).not.toHaveBeenCalled();
  await act(async () => root.unmount()); container.remove();
});
it("shows login link and hides form when already-activated error is returned", async () => {
  const { consumeMemberActivationAction } = await import("./member-activation-actions");
  const token = "b".repeat(43);
  window.history.replaceState(null, "", `/activate-member#token=${token}`);
  (consumeMemberActivationAction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false, error: "该账号已完成激活，请直接使用密码登录。", alreadyActivated: true,
  });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemberActivationPanel />));
  const form = container.querySelector("form")!;
  const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  form.querySelectorAll('input[type="password"]').forEach((input) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    nativeInputValueSetter.call(input, "password9");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { form.requestSubmit(submit); });
  await act(async () => new Promise(r => setTimeout(r, 0)));
  expect(container.textContent).toContain("已完成激活");
  expect(container.querySelector('a[href="/login?tab=password"]')).toBeTruthy();
  expect(container.querySelectorAll('input[type="password"]')).toHaveLength(0);
  await act(async () => root.unmount()); container.remove();
});
