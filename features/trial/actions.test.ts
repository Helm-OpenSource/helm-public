import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const hoistedMocks = vi.hoisted(() => {
  const trialApplicationDelegate = {
    create: vi.fn(async () => ({ id: "trial_test_id" })),
    update: vi.fn(async () => ({ id: "trial_test_id" })),
  };
  const sessionStub = {
    session: {
      user: { id: "user-1" },
      workspace: {
        workspaceClass: "HELM_RESERVED",
        systemKey: "helm_reserved_primary",
      } as { workspaceClass: string; systemKey: string },
    },
  };
  return { trialApplicationDelegate, sessionStub };
});

vi.mock("@/lib/notifications/system-mail", () => ({
  getSystemMailSenderEmail: () => "system@example.com",
  sendSystemMailIfConfigured: vi.fn(async () => ({
    sent: false as const,
    reason: "not_configured" as const,
    sender: "system@example.com",
  })),
  SYSTEM_MAIL_PURPOSES: {
    AUTH_CODE: "auth_code",
    ORG_INVITE: "org_invite",
    TRIAL_APPLICATION_NOTIFY: "trial_application_notify",
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    trialApplication: hoistedMocks.trialApplicationDelegate,
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: vi.fn(async () => hoistedMocks.sessionStub.session),
}));

const { trialApplicationDelegate, sessionStub } = hoistedMocks;

import {
  recordTrialDecisionAction,
  submitTrialApplicationAction,
} from "./actions";
import { sendSystemMailIfConfigured } from "@/lib/notifications/system-mail";

const validInput = {
  email: "founder@acme.io",
  organizationName: "Acme Holdings",
  role: "founder" as const,
  useCase:
    "We want Helm to keep our weekly customer pushes from going silent and make sure follow-through has a clear owner.",
};

afterEach(() => {
  vi.clearAllMocks();
  sessionStub.session.workspace = {
    workspaceClass: "HELM_RESERVED",
    systemKey: "helm_reserved_primary",
  };
});

describe("submitTrialApplicationAction", () => {
  it("accepts a well-formed application and returns ok=true even when mail is not configured", async () => {
    const result = await submitTrialApplicationAction(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delivered).toBe(false);
    }
    expect(trialApplicationDelegate.create).toHaveBeenCalledTimes(1);
    expect(sendSystemMailIfConfigured).toHaveBeenCalledTimes(1);
  });

  it("still resolves ok=true when database insert fails", async () => {
    trialApplicationDelegate.create.mockRejectedValueOnce(new Error("db down"));
    const result = await submitTrialApplicationAction(validInput);
    expect(result.ok).toBe(true);
    expect(sendSystemMailIfConfigured).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed email", async () => {
    const result = await submitTrialApplicationAction({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects use case shorter than 10 characters", async () => {
    const result = await submitTrialApplicationAction({
      ...validInput,
      useCase: "short",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown role values", async () => {
    const result = await submitTrialApplicationAction({
      ...validInput,
      // @ts-expect-error — intentionally invalid to exercise schema enforcement
      role: "ceo",
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok=true delivered=false when mail delivery throws", async () => {
    vi.mocked(sendSystemMailIfConfigured).mockRejectedValueOnce(new Error("smtp down"));
    const result = await submitTrialApplicationAction(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delivered).toBe(false);
    }
  });
});

describe("recordTrialDecisionAction", () => {
  const validDecision = {
    applicationId: "trial_test_id",
    status: "APPROVED" as const,
    decisionReason: "Customer fit confirmed during the intro call.",
  };

  it("rejects callers outside the Helm reserved workspace", async () => {
    sessionStub.session.workspace = {
      workspaceClass: "CUSTOMER",
      systemKey: "customer-demo",
    };
    const result = await recordTrialDecisionAction(validDecision);
    expect(result.ok).toBe(false);
    expect(trialApplicationDelegate.update).not.toHaveBeenCalled();
  });

  it("updates the application when the operator is in the reserved workspace", async () => {
    const result = await recordTrialDecisionAction(validDecision);
    expect(result.ok).toBe(true);
    expect(trialApplicationDelegate.update).toHaveBeenCalledTimes(1);
    expect(trialApplicationDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trial_test_id" },
        data: expect.objectContaining({
          status: "APPROVED",
          decidedByUserId: "user-1",
          decisionReason: validDecision.decisionReason,
        }),
      }),
    );
  });

  it("rejects unsupported decision values", async () => {
    const result = await recordTrialDecisionAction({
      ...validDecision,
      // @ts-expect-error — intentionally invalid to exercise schema enforcement
      status: "PENDING",
    });
    expect(result.ok).toBe(false);
    expect(trialApplicationDelegate.update).not.toHaveBeenCalled();
  });
});
