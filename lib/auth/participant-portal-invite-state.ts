import { ParticipantPortalAccessStatus } from "@prisma/client";

const PARTICIPANT_PORTAL_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type ParticipantPortalInviteState =
  | "usable"
  | "not_found"
  | "invalid_host"
  | "expired"
  | "already_used"
  | "suspended"
  | "archived";

export type ParticipantPortalInviteIssuanceState =
  | "issue_fresh_access"
  | "reissue_existing_invite"
  | "reissue_archived_access"
  | "blocked_active_access"
  | "blocked_suspended_access";

type ParticipantPortalInviteAccessLike = {
  status: ParticipantPortalAccessStatus;
  lastInviteIssuedAt: Date;
};

type ParticipantPortalInviteStateInput = {
  access: ParticipantPortalInviteAccessLike | null;
  workspaceAllowed: boolean;
  now?: Date;
};

type ParticipantPortalInviteIssuanceInput = {
  access: Pick<ParticipantPortalInviteAccessLike, "status"> | null;
};

export function buildParticipantPortalInviteExpiresAt(lastInviteIssuedAt: Date) {
  return new Date(lastInviteIssuedAt.getTime() + PARTICIPANT_PORTAL_INVITE_TTL_MS);
}

export function isParticipantPortalInviteExpired(input: {
  lastInviteIssuedAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return buildParticipantPortalInviteExpiresAt(input.lastInviteIssuedAt).getTime() <= now.getTime();
}

export function isParticipantPortalInviteUsable(input: {
  status: ParticipantPortalAccessStatus;
  lastInviteIssuedAt: Date;
  now?: Date;
}) {
  return (
    input.status === ParticipantPortalAccessStatus.INVITED &&
    !isParticipantPortalInviteExpired({
      lastInviteIssuedAt: input.lastInviteIssuedAt,
      now: input.now,
    })
  );
}

export function resolveParticipantPortalInviteState(
  input: ParticipantPortalInviteStateInput,
): ParticipantPortalInviteState {
  if (!input.access) {
    return "not_found";
  }

  if (!input.workspaceAllowed) {
    return "invalid_host";
  }

  if (input.access.status === ParticipantPortalAccessStatus.ARCHIVED) {
    return "archived";
  }

  if (input.access.status === ParticipantPortalAccessStatus.SUSPENDED) {
    return "suspended";
  }

  if (input.access.status !== ParticipantPortalAccessStatus.INVITED) {
    return "already_used";
  }

  if (
    isParticipantPortalInviteExpired({
      lastInviteIssuedAt: input.access.lastInviteIssuedAt,
      now: input.now,
    })
  ) {
    return "expired";
  }

  return "usable";
}

export function getParticipantPortalInviteStateCopy(
  state: Exclude<ParticipantPortalInviteState, "usable">,
  english: boolean,
) {
  if (state === "not_found") {
    return {
      title: english ? "Portal invite not found" : "没有找到对应的门户邀请",
      description: english
        ? "This access link is invalid or no longer exists. Ask the Helm team to issue a new invite."
        : "这个访问链接无效或已不存在，请联系 Helm 团队重新发放邀请。",
      errorMessage: english
        ? "This portal invitation is invalid or expired"
        : "这个门户邀请无效或已失效",
    };
  }

  if (state === "invalid_host") {
    return {
      title: english ? "Portal invite unavailable" : "这个门户邀请当前不可用",
      description: english
        ? "This access link is not available from the current Helm host. Ask the Helm team to issue a fresh invite."
        : "这个访问链接不适用于当前 Helm host，请联系 Helm 团队重新发放邀请。",
      errorMessage: english
        ? "This portal invitation is not available from the current host"
        : "这个门户邀请不适用于当前访问入口",
    };
  }

  if (state === "expired") {
    return {
      title: english ? "Portal invite expired" : "这个门户邀请已过期",
      description: english
        ? "This access link has expired. Ask the Helm team to issue a new invite."
        : "这个访问链接已经过期，请联系 Helm 团队重新发放邀请。",
      errorMessage: english
        ? "This portal invite has expired. Ask the Helm team to issue a new invite."
        : "这个门户邀请已过期，请联系 Helm 团队重新发放邀请。",
    };
  }

  if (state === "already_used") {
    return {
      title: english ? "Portal invite already used" : "这个门户邀请已经使用过",
      description: english
        ? "This invite has already been accepted and is no longer active. Sign in to the portal or ask the Helm team to issue a new invite."
        : "这个邀请已经被接受，当前已不再处于可用状态。请直接登录门户，或联系 Helm 团队重新发放邀请。",
      errorMessage: english
        ? "This portal invite is no longer active. Ask the Helm team to issue a new invite."
        : "这个门户邀请已不再处于可用状态，请联系 Helm 团队重新发放邀请。",
    };
  }

  if (state === "suspended") {
    return {
      title: english ? "Portal access suspended" : "这个门户访问当前已暂停",
      description: english
        ? "This participant portal access is currently suspended. Contact the Helm team if you need it restored."
        : "这个贡献方门户访问当前已暂停，如需恢复请联系 Helm 团队。",
      errorMessage: english
        ? "This portal access is suspended"
        : "这个门户访问当前已暂停",
    };
  }

  return {
    title: english ? "Portal access archived" : "这个门户访问已归档",
    description: english
      ? "This participant portal access has been archived and can no longer be used. Ask the Helm team if you need a new invite."
      : "这个贡献方门户访问已经归档，不能继续使用。如需重新进入，请联系 Helm 团队发放新邀请。",
    errorMessage: english
      ? "This portal access has been archived"
      : "这个门户访问已归档",
  };
}

export function resolveParticipantPortalInviteIssuanceState(
  input: ParticipantPortalInviteIssuanceInput,
): ParticipantPortalInviteIssuanceState {
  if (!input.access) {
    return "issue_fresh_access";
  }

  if (input.access.status === ParticipantPortalAccessStatus.INVITED) {
    return "reissue_existing_invite";
  }

  if (input.access.status === ParticipantPortalAccessStatus.ARCHIVED) {
    return "reissue_archived_access";
  }

  if (input.access.status === ParticipantPortalAccessStatus.SUSPENDED) {
    return "blocked_suspended_access";
  }

  return "blocked_active_access";
}

export function getParticipantPortalInviteIssuanceDeniedMessage(
  state: Exclude<
    ParticipantPortalInviteIssuanceState,
    "issue_fresh_access" | "reissue_existing_invite" | "reissue_archived_access"
  >,
  english: boolean,
) {
  if (state === "blocked_suspended_access") {
    return english
      ? "This participant portal access is suspended. Restore it before issuing a new invite."
      : "这个贡献方门户访问当前已暂停，请先恢复，再重新发放邀请。";
  }

  return english
    ? "This participant portal access is already active. Do not reissue an invite; use the existing portal access."
    : "这个贡献方门户访问已经激活，不应重新发放邀请；请直接使用现有门户访问。";
}
