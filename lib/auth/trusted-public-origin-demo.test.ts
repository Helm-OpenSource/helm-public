import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), user: vi.fn(), session: vi.fn(), record: vi.fn(), log: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.user } } }));
vi.mock("@/lib/auth/session", () => ({ ACTIVE_WORKSPACE_COOKIE: "workspace", createSession: mocks.session, resolvePreferredMembership: (rows: unknown[]) => rows[0] }));
vi.mock("@/lib/auth/formal-auth", () => ({ normalizeEmailAddress: (s: string) => s }));
vi.mock("@/lib/auth/login-activity", () => ({ recordUserLastLogin: mocks.record }));
vi.mock("@/lib/analytics", () => ({ logEvent: mocks.log }));
vi.mock("@/lib/demo/demo-modes", () => ({ getDemoModeProfile: () => ({ accountEmail: "demo@example.test", quickPath: [{href: "/dashboard"}] }) }));
vi.mock("@/lib/i18n/config", () => ({ resolveUiLocale: () => "en-US", UI_LOCALE_COOKIE: "locale" }));
vi.mock("@/lib/presentation/loading-recovery", () => ({ withLoadingRecoveryFragmentReset: (p: string) => p }));
import { GET, POST } from "@/app/demo/start/route";
function request(method: string, mode = "sales") {
  return new NextRequest(`https://untrusted.example/demo/start?mode=${mode}`, {
    method, headers: { host: "untrusted.example", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "javascript", "content-type": "application/x-www-form-urlencoded" },
    ...(method === "POST" ? { body: new URLSearchParams({mode}) } : {}),
  });
}
describe("demo routes use the trusted origin on every redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://app.example.test");
    mocks.cookies.mockResolvedValue({get: () => undefined}); mocks.user.mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("GET ignores poisoned request URL and proxy headers", async () => {
    expect((await GET(request("GET"))).headers.get("location")).toBe("https://app.example.test/demo?mode=sales#demo-workspace-sales");
  });
  it("invalid form and absent demo user redirect to the same canonical origin", async () => {
    for (const mode of ["invalid", "sales"]) expect((await POST(request("POST", mode))).headers.get("location")).toMatch(/^https:\/\/app\.example\.test\/demo\?/);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("successful POST redirects locally after creating the demo session", async () => {
    mocks.user.mockResolvedValue({ id: "demo-user", email: "demo@example.test", phone: null, memberships: [{ workspaceId: "demo-workspace" }] });
    expect((await POST(request("POST"))).headers.get("location")).toBe("https://app.example.test/dashboard");
    expect(mocks.session).toHaveBeenCalledOnce();
  });
  it("missing production origin refuses GET and POST before cookies or database", async () => {
    vi.stubEnv("APP_URL", "");
    await expect(GET(request("GET"))).rejects.toThrow("public_origin_invalid");
    await expect(POST(request("POST"))).rejects.toThrow("public_origin_invalid");
    expect(mocks.cookies).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled();
  });
});
