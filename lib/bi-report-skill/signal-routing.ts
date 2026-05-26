import {
  findMembershipsWithExistingUsers,
} from "@/lib/auth/membership-with-user";
import type {
  BiReportSeverity,
  BiReportSignalRoutingConfig,
} from "@/lib/bi-report-skill/types";

type WorkspaceRole = "OWNER" | "BILLING_ADMIN" | "ADMIN" | "OPERATOR" | "REVIEWER" | "MEMBER";
type RolePresetKey =
  | "FOUNDER_CEO"
  | "SALES_LEAD"
  | "ACCOUNT_EXECUTIVE"
  | "RECRUITER"
  | "CUSTOMER_SUCCESS"
  | "DELIVERY_LEAD"
  | "PRODUCT_ENGINEER"
  | "OPERATIONS_FINANCE"
  | "GENERAL_OPERATOR";

export type BiReportSignalOwner = {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
};

type RoutingProfile = {
  preferredRoles?: WorkspaceRole[];
  preferredRolePresetKeys?: RolePresetKey[];
  preferredPersonaKeywords?: string[];
};

const severityRolePreferences: Record<BiReportSeverity, WorkspaceRole[]> = {
  CLEAR: ["REVIEWER", "OPERATOR", "ADMIN", "OWNER", "MEMBER", "BILLING_ADMIN"],
  WATCH: ["REVIEWER", "OPERATOR", "ADMIN", "OWNER", "MEMBER", "BILLING_ADMIN"],
  WARN: ["OPERATOR", "ADMIN", "OWNER", "REVIEWER", "MEMBER", "BILLING_ADMIN"],
  ALERT: ["ADMIN", "OWNER", "OPERATOR", "REVIEWER", "MEMBER", "BILLING_ADMIN"],
  CRITICAL: ["OWNER", "ADMIN", "OPERATOR", "REVIEWER", "BILLING_ADMIN", "MEMBER"],
};

const skillRoleOverrides: Partial<Record<string, Partial<Record<BiReportSeverity, WorkspaceRole[]>>>> = {
  bi_business_income_expense_monthly: {
    ALERT: ["OWNER", "ADMIN", "BILLING_ADMIN", "OPERATOR", "REVIEWER", "MEMBER"],
    CRITICAL: ["OWNER", "ADMIN", "BILLING_ADMIN", "OPERATOR", "REVIEWER", "MEMBER"],
  },
  bi_mtype_repay_monthly: {
    WARN: ["OPERATOR", "ADMIN", "OWNER", "REVIEWER", "MEMBER", "BILLING_ADMIN"],
    ALERT: ["OPERATOR", "ADMIN", "OWNER", "REVIEWER", "MEMBER", "BILLING_ADMIN"],
    CRITICAL: ["OWNER", "ADMIN", "OPERATOR", "REVIEWER", "MEMBER", "BILLING_ADMIN"],
  },
};

export async function resolveBiReportSignalOwner(input: {
  workspaceId: string;
  skillKey: string;
  severity: BiReportSeverity;
  signalType?: string | null;
  signalRouting?: BiReportSignalRoutingConfig;
}): Promise<BiReportSignalOwner | null> {
  const preferredRoles =
    skillRoleOverrides[input.skillKey]?.[input.severity] ?? severityRolePreferences[input.severity];
  const routingProfile = buildRoutingProfile({
    skillKey: input.skillKey,
    signalType: input.signalType ?? null,
    preferredRoles,
  });

  const memberships = await findMembershipsWithExistingUsers({
    where: {
      workspaceId: input.workspaceId,
      status: "ACTIVE",
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  if (!memberships.length) {
    return null;
  }

  const rankedMembership = [...memberships].sort((left, right) => {
    const scoreDelta =
      scoreMembershipForRouting(right, routingProfile) - scoreMembershipForRouting(left, routingProfile);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.joinedAt.getTime() - right.joinedAt.getTime();
  })[0];

  if (!rankedMembership) {
    return null;
  }

  return {
    userId: rankedMembership.user.id,
    name: rankedMembership.user.name,
    email: rankedMembership.user.email,
    role: rankedMembership.role as WorkspaceRole,
  };
}

function buildRoutingProfile(input: {
  skillKey: string;
  signalType: string | null;
  preferredRoles: WorkspaceRole[];
}): RoutingProfile {
  const signalType = normalizeText(input.signalType);

  if (
    signalType?.includes("complaint") ||
    signalType === "manager_daily_intervention_required" ||
    input.skillKey === "bi_collection_operating_signal_daily"
  ) {
    return {
      preferredRoles: input.preferredRoles,
      preferredRolePresetKeys: ["DELIVERY_LEAD", "CUSTOMER_SUCCESS", "FOUNDER_CEO"],
      preferredPersonaKeywords: ["主管", "经理", "lead", "manager", "交付", "customer success"],
    };
  }

  if (
    signalType?.includes("repay") ||
    signalType?.includes("finance") ||
    input.skillKey.includes("income_expense") ||
    input.skillKey.includes("repay")
  ) {
    return {
      preferredRoles: input.preferredRoles,
      preferredRolePresetKeys: ["OPERATIONS_FINANCE", "FOUNDER_CEO", "GENERAL_OPERATOR"],
      preferredPersonaKeywords: ["财务", "finance", "运营", "ops"],
    };
  }

  if (
    signalType?.includes("followup") ||
    signalType?.includes("first_touch") ||
    signalType?.includes("record_upload") ||
    signalType?.includes("connect") ||
    signalType?.includes("process") ||
    signalType?.includes("ptp")
  ) {
    return {
      preferredRoles: input.preferredRoles,
      preferredRolePresetKeys: ["GENERAL_OPERATOR", "OPERATIONS_FINANCE", "DELIVERY_LEAD"],
      preferredPersonaKeywords: ["催收", "运营", "专员", "operator", "collection"],
    };
  }

  return {
    preferredRoles: input.preferredRoles,
  };
}

function scoreMembershipForRouting(
  membership: Awaited<ReturnType<typeof findMembershipsWithExistingUsers>>[number],
  profile: RoutingProfile,
) {
  let score = 0;

  const roleIndex = profile.preferredRoles?.indexOf(membership.role as WorkspaceRole) ?? -1;
  if (roleIndex >= 0) {
    score += 40 - roleIndex * 4;
  }

  const rolePresetKey = normalizeTextExact(membership.rolePresetKey);
  const presetIndex =
    rolePresetKey && profile.preferredRolePresetKeys
      ? profile.preferredRolePresetKeys.findIndex((item) => item === rolePresetKey)
      : -1;
  if (presetIndex >= 0) {
    score += 120 - presetIndex * 20;
  }

  const persona = normalizeText(membership.persona);
  const personaIndex =
    persona && profile.preferredPersonaKeywords
      ? profile.preferredPersonaKeywords.findIndex((keyword) =>
          persona.includes(keyword.trim().toLowerCase()),
        )
      : -1;
  if (personaIndex >= 0) {
    score += 80 - personaIndex * 10;
  }

  return score;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizeTextExact(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
