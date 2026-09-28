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
