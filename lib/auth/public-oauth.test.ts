import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  buildPublicOauthSignupUrl,
  PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE,
  readPublicOauthState,
  readPublicOauthSignupPrefillCookie,
  resolvePublicOauthUserMatch,
  writePublicOauthSignupPrefillCookie,
} from "@/lib/auth/public-oauth";

function createCookieStore() {
  const values = new Map<string, string>();

  return {
    get(name: string) {
      const value = values.get(name);
      return value ? { name, value } : undefined;
    },
    set(name: string, value: string) {
      values.set(name, value);
    },
    delete(name: string) {
      values.delete(name);
    },
  };
}

function buildMatchedUser(id: string) {
  return {
    id,
    email: `${id}@helm.so`,
    phone: "+8613800138000",
    name: "Owner",
    memberships: [
      {
        workspaceId: `workspace-${id}`,
        role: "OWNER",
        status: "ACTIVE",
        workspace: {
          id: `workspace-${id}`,
          defaultLocale: "zh-CN",
          demoMode: false,
          profileType: null,
        },
      },
    ],
  };
}

describe("public oauth identity match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns missing-identity when email and phone are both absent", async () => {
    const result = await resolvePublicOauthUserMatch({
      email: null,
      phone: null,
    });

    expect(result.status).toBe("missing-identity");
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns identity-conflict when email and phone map to different users", async () => {
    dbMock.user.findFirst
      .mockResolvedValueOnce(buildMatchedUser("email-user"))
      .mockResolvedValueOnce(buildMatchedUser("phone-user"));

    const result = await resolvePublicOauthUserMatch({
      email: "owner@helm.so",
      phone: "13800138000",
    });

    expect(result.status).toBe("identity-conflict");
  });

  it("prefers phone match when requested by provider flow", async () => {
    dbMock.user.findFirst
      .mockResolvedValueOnce(buildMatchedUser("email-user"))
      .mockResolvedValueOnce(buildMatchedUser("phone-user"));

    const result = await resolvePublicOauthUserMatch({
      email: "owner@helm.so",
      phone: "13800138000",
      preferPhoneMatch: true,
    });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.user.id).toBe("phone-user");
    }
  });

  it("returns matched when one active user can be resolved", async () => {
    dbMock.user.findFirst
      .mockResolvedValueOnce(buildMatchedUser("email-user"))
      .mockResolvedValueOnce(null);

    const result = await resolvePublicOauthUserMatch({
      email: "owner@helm.so",
      phone: "13800138000",
    });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.user.id).toBe("email-user");
    }
  });

  it("returns unmatched when identity exists but no member user is found", async () => {
    dbMock.user.findFirst.mockResolvedValueOnce(null);

    const result = await resolvePublicOauthUserMatch({
      email: "missing@helm.so",
      phone: null,
    });

    expect(result.status).toBe("unmatched");
  });
});

describe("public oauth prefill cookie", () => {
  it("writes and reads a short-lived httpOnly prefill cookie", () => {
    const cookieStore = createCookieStore();
    const now = new Date("2026-04-17T10:00:00.000Z");

    writePublicOauthSignupPrefillCookie(
      cookieStore,
      {
        provider: "dingtalk",
        name: "  Alice  ",
        email: "  ALICE@HELM.SO  ",
        phone: "13800138000",
        organizationName: "  Helm 中国团队  ",
      },
      now,
    );

    const rawCookie = cookieStore.get(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE)?.value ?? null;
    const parsed = readPublicOauthSignupPrefillCookie(rawCookie, new Date("2026-04-17T10:03:00.000Z"));

    expect(parsed).toEqual({
      provider: "dingtalk",
      name: "Alice",
      email: "alice@helm.so",
      phone: "+8613800138000",
      organizationName: "Helm 中国团队",
    });
  });

  it("treats expired prefill cookie as invalid", () => {
    const cookieStore = createCookieStore();
    const now = new Date("2026-04-17T10:00:00.000Z");

    writePublicOauthSignupPrefillCookie(
      cookieStore,
      {
        provider: "dingtalk",
        name: "Alice",
        email: "alice@helm.so",
        phone: "13800138000",
      },
      now,
    );

    const rawCookie = cookieStore.get(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE)?.value ?? null;

    expect(readPublicOauthSignupPrefillCookie(rawCookie, new Date("2026-04-17T10:06:00.000Z"))).toBeNull();
  });
});

describe("public oauth signup redirect", () => {
  it("keeps signup prefill out of URL query", () => {
    const request = new Request("https://helm.example.com/api/auth/dingtalk/callback");

    const signupUrl = buildPublicOauthSignupUrl(request, {
      provider: "dingtalk",
      name: "Alice",
      email: "alice@helm.so",
      phone: "13800138000",
    });

    expect(signupUrl.pathname).toBe("/login");
    expect(signupUrl.searchParams.get("tab")).toBe("signup");
    expect(signupUrl.searchParams.get("provider")).toBe("dingtalk");
    expect(signupUrl.searchParams.get("prefill")).toBe("1");
    expect(signupUrl.searchParams.get("name")).toBeNull();
    expect(signupUrl.searchParams.get("email")).toBeNull();
    expect(signupUrl.searchParams.get("phone")).toBeNull();
  });
});

describe("public oauth state payload", () => {
  it("reads optional qr flow id from state cookie payload", () => {
    const parsed = readPublicOauthState(
      JSON.stringify({
        state: "state-1",
        locale: "zh-CN",
        flowId: "flow-1",
        organizationName: "Helm 中国团队",
      }),
    );

    expect(parsed).toEqual({
      state: "state-1",
      locale: "zh-CN",
      flowId: "flow-1",
      organizationName: "Helm 中国团队",
    });
  });

  it("accepts feishu as a valid provider payload", () => {
    const cookieStore = createCookieStore();
    const now = new Date("2026-05-20T10:00:00.000Z");

    writePublicOauthSignupPrefillCookie(
      cookieStore,
      {
        provider: "feishu",
        name: "Alice",
        email: "alice@helm.so",
      },
      now,
    );

    const parsed = readPublicOauthSignupPrefillCookie(
      cookieStore.get(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE)?.value ?? null,
      new Date("2026-05-20T10:03:00.000Z"),
    );

    expect(parsed?.provider).toBe("feishu");
  });
});
