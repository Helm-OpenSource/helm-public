import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirectMock,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/features/auth/first-login-identity-completion-panel", () => ({
  FirstLoginIdentityCompletionPanel: () =>
    createElement("div", { "data-testid": "identity-completion-panel" }, "identity-completion-panel"),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUserMock,
}));

import GettingStartedPage from "@/app/getting-started/page";

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    get: vi.fn((name: string) => {
      const value = values.get(name);
      return value ? { name, value } : undefined;
    }),
  };
}

function buildRedirectError(path: string) {
  return new Error(`REDIRECT:${path}`);
}

describe("getting-started salvage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookiesMock.mockResolvedValue(createCookieStore());
  });

  it("keeps the page as an explicit-only orientation surface with dashboard/setup exits", async () => {
    mocks.getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    mocks.cookiesMock.mockResolvedValue(createCookieStore({ "helm-ui-locale": "en-US" }));

    const element = await GettingStartedPage({});
    const html = renderToStaticMarkup(element);

    expect(html).toContain("3 steps");
    expect(html).toContain("first judgement card");
    expect(html).toContain("Continue to dashboard");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/setup?onboarding=trial"');
  });

  it("redirects anonymous visitors back to /login", async () => {
    mocks.getCurrentUserMock.mockResolvedValue(null);
    mocks.redirectMock.mockImplementation((path: string) => {
      throw buildRedirectError(path);
    });

    await expect(GettingStartedPage({})).rejects.toThrow("REDIRECT:/login");
  });

  it("renders identity completion mode when pending cookie exists", async () => {
    mocks.getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      phone: null,
      passwordHash: null,
    });
    mocks.cookiesMock.mockResolvedValue(
      createCookieStore({
        "helm-ui-locale": "zh-CN",
        "helm-first-login-identity-setup": "1",
      }),
    );

    const element = await GettingStartedPage({
      searchParams: Promise.resolve({ mode: "identity-completion" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("首次登录初始化");
    expect(html).toContain("identity-completion-panel");
    expect(html).not.toContain("3 步");
  });
});
