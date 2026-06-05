import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";
import { formatAuthSessionProvider } from "./governance-formatters";

export type AuthSessionRevokeScope =
  | "STALE_ACTIVE"
  | "LEGACY_PROVIDER"
  | "MISSING_SOURCE_PAGE"
  | "MISSING_WORKSPACE_SWITCH_MARKER"
  | "PROVIDER_SOURCE_MISMATCH"
  | "WORKSPACE_MEMBERSHIP_MISMATCH"
  | "OTHER_ACTIVE";

type AuthSessionAnomalyScope = AuthSessionRevokeScope | "EXPIRING_SOON";
type AuthSessionAnomalyManagementMode = "BULK_REVOKE" | "REVIEW_ONLY";
type AuthSessionRevokeConsistencyStatus = "DRIFT" | "REVOCABLE" | "REVIEW_ONLY" | "CLEAR";
type AuthControlConsistencyStatus = "DRIFT" | "ACTIONABLE" | "REVIEW_ONLY" | "CLEAR";
type AuthControlFollowThroughStatus = "STALE" | "PENDING" | "CURRENT" | "CLEAR";

type AuthSessionScopeRevokeSummaryItem = {
  scope: AuthSessionRevokeScope;
  actionCount: number;
  revokedSessionCount: number;
};

type AuthSessionLiveRevokeSummaryItem = {
  scope: AuthSessionRevokeScope;
  eligibleSessionCount: number;
  currentSessionProtected: boolean;
};

type AuthSessionAnomalyInventorySummaryItem = {
  scope: AuthSessionAnomalyScope;
  managementMode: AuthSessionAnomalyManagementMode;
  activeSessionCount: number;
  revocableSessionCount: number;
  currentSessionProtected: boolean;
};

type AuthSessionPreviewVsExecutedScopeSummaryItem = {
  scope: AuthSessionRevokeScope;
  liveEligibleSessionCount: number;
  currentSessionProtected: boolean;
  lastExecutedAt: Date | string | null;
  lastExecutedEligibleSessionCount: number | null;
  lastExecutedRevokedSessionCount: number | null;
  previewEligibleDeltaCount: number | null;
  lastExecutionShortfallCount: number | null;
};

type AuthSessionRevokeConsistencySummaryItem = {
  scope: AuthSessionRevokeScope;
  status: AuthSessionRevokeConsistencyStatus;
  liveEligibleSessionCount: number;
  currentSessionProtected: boolean;
  lastExecutedAt: Date | string | null;
  previewEligibleDeltaCount: number | null;
  lastExecutionShortfallCount: number | null;
};

type AuthControlConsistencyOverview = {
  consistencyStatus: AuthControlConsistencyStatus;
  followThroughStatus: AuthControlFollowThroughStatus;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestDetectedAt: Date | string | null;
  latestMarkerScopeCount: number;
  latestFollowThroughActionType: string | null;
  latestFollowThroughRecordedAt: Date | string | null;
  latestFollowThroughSourcePage: string | null;
};

type LatestAuthAnomalyFollowThroughSummary = {
  status: AuthControlConsistencyStatus;
  followThroughStatus: AuthControlFollowThroughStatus;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestMarkerRecordedAt: Date | string | null;
  latestMarkerScopeCount: number;
  latestFollowThroughActionType: string | null;
  latestFollowThroughRecordedAt: Date | string | null;
  latestFollowThroughSourcePage: string | null;
};

type LatestMarkerCoverageSummary = {
  status: AuthControlConsistencyStatus;
  followThroughStatus: AuthControlFollowThroughStatus;
  stillDetectedScopeCount: number;
  resolvedScopeCount: number;
  newlyDetectedScopeCount: number;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestMarkerRecordedAt: Date | string | null;
  latestMarkerScopeCount: number;
  latestFollowThroughActionType: string | null;
  latestFollowThroughRecordedAt: Date | string | null;
  latestFollowThroughSourcePage: string | null;
};

type RevokeExecutionAggregateSummary = {
  status: AuthControlConsistencyStatus;
  liveEligibleSessionCount: number;
  lastExecutedEligibleSessionCount: number;
  lastExecutedRevokedSessionCount: number;
  executionShortfallCount: number;
  previewEligibleDeltaCount: number;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestExecutedAt: Date | string | null;
};

type AuthSessionAnomalyMarker = {
  user: {
    name: string;
  };
  providerType: string | null;
  sourcePage: string | null;
  activeWorkspaceId: string | null;
  anomalyScopes: AuthSessionAnomalyScope[];
} | null;

function formatOptionalDateLabel(value: Date | string | null | undefined, english: boolean) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (english) {
    return format(date, "MMM d HH:mm", { locale: enUS });
  }

  return formatDateLabel(date);
}

export function formatAuthSessionRevokeScope(
  scope: AuthSessionRevokeScope,
  english: boolean,
) {
  switch (scope) {
    case "STALE_ACTIVE":
      return english ? "stale active sessions" : "陈旧活跃会话";
    case "LEGACY_PROVIDER":
      return english ? "legacy-provider sessions" : "旧来源服务商会话";
    case "MISSING_SOURCE_PAGE":
      return english ? "missing-source sessions" : "缺少来源页会话";
    case "MISSING_WORKSPACE_SWITCH_MARKER":
      return english ? "missing workspace-switch marker sessions" : "缺少工作区切换标记会话";
    case "PROVIDER_SOURCE_MISMATCH":
      return english ? "provider/source mismatch sessions" : "来源服务商 / 来源页不一致会话";
    case "WORKSPACE_MEMBERSHIP_MISMATCH":
      return english ? "workspace-membership mismatch sessions" : "工作区成员归属不一致会话";
    case "OTHER_ACTIVE":
      return english ? "other active sessions" : "其他活跃会话";
  }
}

export function formatAuthSessionScopeRevokeSummary(
  items: AuthSessionScopeRevokeSummaryItem[],
  english: boolean,
) {
  if (items.length === 0) {
    return english ? "No scoped bulk revoke recorded." : "当前还没有范围级批量撤销记录。";
  }

  return items
    .map(
      (item) =>
        `${formatAuthSessionRevokeScope(item.scope, english)} · ${
          english
            ? `${item.actionCount} actions / ${item.revokedSessionCount} sessions`
            : `${item.actionCount} 次 / ${item.revokedSessionCount} 个会话`
        }`,
    )
    .join(" · ");
}

export function formatAuthSessionLiveRevokeSummary(
  items: AuthSessionLiveRevokeSummaryItem[],
  english: boolean,
) {
  const reviewItems = items.filter(
    (item) => item.eligibleSessionCount > 0 || item.currentSessionProtected,
  );

  if (reviewItems.length === 0) {
    return english
      ? "No current bulk-revoke candidates are active."
      : "当前没有可执行的批量撤销候选。";
  }

  return reviewItems
    .map((item) => {
      const parts = [
        formatAuthSessionRevokeScope(item.scope, english),
        english ? `${item.eligibleSessionCount} eligible` : `可撤销 ${item.eligibleSessionCount} 个`,
      ];

      if (item.currentSessionProtected) {
        parts.push(english ? "current session protected" : "当前会话受保护");
      }

      return parts.join(" · ");
    })
    .join(" · ");
}

function formatAuthSessionAnomalyManagementMode(
  mode: AuthSessionAnomalyManagementMode,
  english: boolean,
) {
  if (mode === "BULK_REVOKE") {
    return english ? "bulk revoke" : "批量撤销";
  }

  return english ? "review only" : "仅供复核";
}

function formatAuthSessionAnomalyScope(
  scope: AuthSessionAnomalyScope,
  english: boolean,
) {
  if (scope === "EXPIRING_SOON") {
    return english ? "expiring soon" : "即将过期";
  }

  return formatAuthSessionRevokeScope(scope, english);
}

export function formatAuthSessionAnomalyInventorySummary(
  items: AuthSessionAnomalyInventorySummaryItem[],
  english: boolean,
) {
  const reviewItems = items.filter((item) => item.activeSessionCount > 0);

  if (reviewItems.length === 0) {
    return english
      ? "No active auth-session anomaly inventory is currently material."
      : "当前没有需要关注的认证会话异常清单。";
  }

  return reviewItems
    .map((item) => {
      const parts = [
        formatAuthSessionAnomalyScope(item.scope, english),
        formatAuthSessionAnomalyManagementMode(item.managementMode, english),
        english ? `${item.activeSessionCount} active` : `活跃 ${item.activeSessionCount} 个`,
      ];

      if (item.managementMode === "BULK_REVOKE") {
        parts.push(
          english ? `${item.revocableSessionCount} revocable` : `可撤销 ${item.revocableSessionCount} 个`,
        );
      }

      if (item.currentSessionProtected) {
        parts.push(english ? "current session protected" : "当前会话受保护");
      }

      return parts.join(" · ");
    })
    .join(" · ");
}

export function formatAuthSessionReviewScopeSummary(
  items: AuthSessionRevokeScope[],
  english: boolean,
) {
  if (items.length === 0) {
    return english
      ? "Current session does not match any review-only anomaly scope."
      : "当前会话没有命中任何仅供复核的异常范围。";
  }

  return items.map((scope) => formatAuthSessionRevokeScope(scope, english)).join(" · ");
}

export function formatAuthSessionPreviewVsExecutedScopeSummary(
  items: AuthSessionPreviewVsExecutedScopeSummaryItem[],
  english: boolean,
) {
  const reviewItems = items.filter(
    (item) =>
      item.liveEligibleSessionCount > 0 ||
      item.currentSessionProtected ||
      item.lastExecutedAt ||
      item.previewEligibleDeltaCount !== null ||
      item.lastExecutionShortfallCount !== null,
  );

  if (reviewItems.length === 0) {
    return english
      ? "No preview-vs-executed revoke delta is currently material."
      : "当前没有需要关注的预估与实际执行撤销差异。";
  }

  return reviewItems
    .map((item) => {
      const parts = [
        formatAuthSessionRevokeScope(item.scope, english),
        english ? `live ${item.liveEligibleSessionCount}` : `当前 ${item.liveEligibleSessionCount} 个`,
      ];

      if (item.currentSessionProtected) {
        parts.push(english ? "current session protected" : "当前会话受保护");
      }

      if (item.lastExecutedAt && item.lastExecutedEligibleSessionCount !== null) {
        parts.push(
          english
            ? `last run ${item.lastExecutedRevokedSessionCount ?? 0}/${item.lastExecutedEligibleSessionCount}`
            : `上次执行 ${item.lastExecutedRevokedSessionCount ?? 0}/${item.lastExecutedEligibleSessionCount}`,
        );
      }

      if (item.previewEligibleDeltaCount !== null && item.previewEligibleDeltaCount !== 0) {
        parts.push(
          english
            ? `delta ${item.previewEligibleDeltaCount > 0 ? "+" : ""}${item.previewEligibleDeltaCount}`
            : `差值 ${item.previewEligibleDeltaCount > 0 ? "+" : ""}${item.previewEligibleDeltaCount}`,
        );
      }

      if (item.lastExecutionShortfallCount !== null && item.lastExecutionShortfallCount > 0) {
        parts.push(
          english ? `shortfall ${item.lastExecutionShortfallCount}` : `短缺 ${item.lastExecutionShortfallCount}`,
        );
      }

      return parts.join(" · ");
    })
    .join(" · ");
}

function formatAuthSessionRevokeConsistencyStatus(
  status: AuthSessionRevokeConsistencyStatus,
  english: boolean,
) {
  switch (status) {
    case "DRIFT":
      return english ? "drift" : "存在漂移";
    case "REVOCABLE":
      return english ? "revocable" : "可撤销";
    case "REVIEW_ONLY":
      return english ? "review only" : "仅供复核";
    case "CLEAR":
      return english ? "clear" : "已清空";
  }
}

export function formatAuthSessionRevokeConsistencySummary(
  items: AuthSessionRevokeConsistencySummaryItem[],
  english: boolean,
) {
  const reviewItems = items.filter(
    (item) =>
      item.status !== "CLEAR" ||
      item.liveEligibleSessionCount > 0 ||
      item.currentSessionProtected ||
      item.lastExecutedAt,
  );

  if (reviewItems.length === 0) {
    return english
      ? "No revoke consistency issue is currently material."
      : "当前没有需要关注的撤销一致性问题。";
  }

  return reviewItems
    .map((item) => {
      const parts = [
        formatAuthSessionRevokeScope(item.scope, english),
        formatAuthSessionRevokeConsistencyStatus(item.status, english),
        english ? `live ${item.liveEligibleSessionCount}` : `当前 ${item.liveEligibleSessionCount} 个`,
      ];

      if (item.currentSessionProtected) {
        parts.push(english ? "current session protected" : "当前会话受保护");
      }

      if (item.previewEligibleDeltaCount !== null && item.previewEligibleDeltaCount !== 0) {
        parts.push(
          english
            ? `delta ${item.previewEligibleDeltaCount > 0 ? "+" : ""}${item.previewEligibleDeltaCount}`
            : `差值 ${item.previewEligibleDeltaCount > 0 ? "+" : ""}${item.previewEligibleDeltaCount}`,
        );
      }

      if (item.lastExecutionShortfallCount !== null && item.lastExecutionShortfallCount > 0) {
        parts.push(
          english ? `shortfall ${item.lastExecutionShortfallCount}` : `短缺 ${item.lastExecutionShortfallCount}`,
        );
      }

      return parts.join(" · ");
    })
    .join(" · ");
}

function formatAuthControlConsistencyStatus(
  status: AuthControlConsistencyStatus,
  english: boolean,
) {
  switch (status) {
    case "DRIFT":
      return english ? "drift" : "存在漂移";
    case "ACTIONABLE":
      return english ? "actionable" : "可操作";
    case "REVIEW_ONLY":
      return english ? "review only" : "仅供复核";
    case "CLEAR":
      return english ? "clear" : "已清空";
  }
}

function formatAuthControlFollowThroughStatus(
  status: AuthControlFollowThroughStatus,
  english: boolean,
) {
  switch (status) {
    case "STALE":
      return english ? "stale" : "已滞后";
    case "PENDING":
      return english ? "pending" : "待跟进";
    case "CURRENT":
      return english ? "current" : "已对齐";
    case "CLEAR":
      return english ? "clear" : "已清空";
  }
}

export function formatAuthControlConsistencyOverview(
  overview: AuthControlConsistencyOverview,
  english: boolean,
) {
  const parts = [
    formatAuthControlConsistencyStatus(overview.consistencyStatus, english),
    english
      ? `follow-through ${formatAuthControlFollowThroughStatus(overview.followThroughStatus, english)}`
      : `跟进 ${formatAuthControlFollowThroughStatus(overview.followThroughStatus, english)}`,
    english
      ? `${overview.reviewOnlyScopeCount} review-only scopes`
      : `${overview.reviewOnlyScopeCount} 个仅复核范围`,
    english
      ? `${overview.bulkRevocableScopeCount} actionable scopes`
      : `${overview.bulkRevocableScopeCount} 个可执行范围`,
    english ? `${overview.driftScopeCount} drift scopes` : `${overview.driftScopeCount} 个漂移范围`,
    english
      ? `${overview.currentSessionProtectedScopeCount} current-session protected`
      : `${overview.currentSessionProtectedScopeCount} 个当前会话受保护`,
  ];

  const latestDetectedLabel = formatOptionalDateLabel(overview.latestDetectedAt, english);
  if (latestDetectedLabel) {
    parts.push(english ? `latest anomaly ${latestDetectedLabel}` : `最近异常 ${latestDetectedLabel}`);
  }

  if (overview.latestMarkerScopeCount > 0) {
    parts.push(
      english
        ? `latest marker ${overview.latestMarkerScopeCount} scope(s)`
        : `最近标记 ${overview.latestMarkerScopeCount} 个范围`,
    );
  }

  if (overview.latestFollowThroughActionType) {
    parts.push(
      english
        ? `latest follow-through ${overview.latestFollowThroughActionType}`
        : `最近跟进 ${overview.latestFollowThroughActionType}`,
    );
  }

  const latestRecordedLabel = formatOptionalDateLabel(overview.latestFollowThroughRecordedAt, english);
  if (latestRecordedLabel) {
    parts.push(english ? `recorded ${latestRecordedLabel}` : `记录于 ${latestRecordedLabel}`);
  }

  if (overview.latestFollowThroughSourcePage) {
    parts.push(
      english ? `from ${overview.latestFollowThroughSourcePage}` : `来源 ${overview.latestFollowThroughSourcePage}`,
    );
  }

  return parts.join(" · ");
}

export function formatLatestAuthAnomalyFollowThroughSummary(
  summary: LatestAuthAnomalyFollowThroughSummary,
  english: boolean,
) {
  const parts = [
    formatAuthControlConsistencyStatus(summary.status, english),
    english
      ? `follow-through ${formatAuthControlFollowThroughStatus(summary.followThroughStatus, english)}`
      : `跟进 ${formatAuthControlFollowThroughStatus(summary.followThroughStatus, english)}`,
    english
      ? `${summary.reviewOnlyScopeCount} review-only scopes`
      : `${summary.reviewOnlyScopeCount} 个仅复核范围`,
    english
      ? `${summary.bulkRevocableScopeCount} actionable scopes`
      : `${summary.bulkRevocableScopeCount} 个可执行范围`,
    english ? `${summary.driftScopeCount} drift scopes` : `${summary.driftScopeCount} 个漂移范围`,
    english
      ? `${summary.currentSessionProtectedScopeCount} current-session protected`
      : `${summary.currentSessionProtectedScopeCount} 个当前会话受保护`,
  ];

  const latestMarkerLabel = formatOptionalDateLabel(summary.latestMarkerRecordedAt, english);
  if (latestMarkerLabel) {
    parts.push(english ? `latest marker ${latestMarkerLabel}` : `最近标记 ${latestMarkerLabel}`);
  }

  if (summary.latestMarkerScopeCount > 0) {
    parts.push(
      english
        ? `${summary.latestMarkerScopeCount} marker scope(s)`
        : `${summary.latestMarkerScopeCount} 个标记范围`,
    );
  }

  if (summary.latestFollowThroughActionType) {
    parts.push(
      english
        ? `latest follow-through ${summary.latestFollowThroughActionType}`
        : `最近跟进 ${summary.latestFollowThroughActionType}`,
    );
  }

  const latestRecordedLabel = formatOptionalDateLabel(summary.latestFollowThroughRecordedAt, english);
  if (latestRecordedLabel) {
    parts.push(english ? `recorded ${latestRecordedLabel}` : `记录于 ${latestRecordedLabel}`);
  }

  if (summary.latestFollowThroughSourcePage) {
    parts.push(
      english ? `from ${summary.latestFollowThroughSourcePage}` : `来源 ${summary.latestFollowThroughSourcePage}`,
    );
  }

  return parts.join(" · ");
}

export function formatLatestMarkerCoverageSummary(
  summary: LatestMarkerCoverageSummary,
  english: boolean,
) {
  const parts = [
    formatAuthControlConsistencyStatus(summary.status, english),
    english
      ? `follow-through ${formatAuthControlFollowThroughStatus(summary.followThroughStatus, english)}`
      : `跟进 ${formatAuthControlFollowThroughStatus(summary.followThroughStatus, english)}`,
    english ? `${summary.stillDetectedScopeCount} still detected` : `${summary.stillDetectedScopeCount} 个仍在出现`,
    english ? `${summary.resolvedScopeCount} resolved` : `${summary.resolvedScopeCount} 个已消失`,
    english ? `${summary.newlyDetectedScopeCount} newly detected` : `${summary.newlyDetectedScopeCount} 个新出现`,
    english
      ? `${summary.reviewOnlyScopeCount} review-only scopes`
      : `${summary.reviewOnlyScopeCount} 个仅复核范围`,
    english
      ? `${summary.bulkRevocableScopeCount} actionable scopes`
      : `${summary.bulkRevocableScopeCount} 个可执行范围`,
    english ? `${summary.driftScopeCount} drift scopes` : `${summary.driftScopeCount} 个漂移范围`,
    english
      ? `${summary.currentSessionProtectedScopeCount} current-session protected`
      : `${summary.currentSessionProtectedScopeCount} 个当前会话受保护`,
  ];

  const latestMarkerLabel = formatOptionalDateLabel(summary.latestMarkerRecordedAt, english);
  if (latestMarkerLabel) {
    parts.push(english ? `latest marker ${latestMarkerLabel}` : `最近标记 ${latestMarkerLabel}`);
  }

  if (summary.latestMarkerScopeCount > 0) {
    parts.push(
      english
        ? `${summary.latestMarkerScopeCount} marker scope(s)`
        : `${summary.latestMarkerScopeCount} 个标记范围`,
    );
  }

  if (summary.latestFollowThroughActionType) {
    parts.push(
      english
        ? `latest follow-through ${summary.latestFollowThroughActionType}`
        : `最近跟进 ${summary.latestFollowThroughActionType}`,
    );
  }

  const latestRecordedLabel = formatOptionalDateLabel(summary.latestFollowThroughRecordedAt, english);
  if (latestRecordedLabel) {
    parts.push(english ? `recorded ${latestRecordedLabel}` : `记录于 ${latestRecordedLabel}`);
  }

  if (summary.latestFollowThroughSourcePage) {
    parts.push(
      english ? `from ${summary.latestFollowThroughSourcePage}` : `来源 ${summary.latestFollowThroughSourcePage}`,
    );
  }

  return parts.join(" · ");
}

export function formatRevokeExecutionAggregateSummary(
  summary: RevokeExecutionAggregateSummary,
  english: boolean,
) {
  const parts = [
    formatAuthControlConsistencyStatus(summary.status, english),
    english ? `${summary.liveEligibleSessionCount} live eligible` : `${summary.liveEligibleSessionCount} 个当前可撤销`,
    english
      ? `${summary.lastExecutedEligibleSessionCount} last executed eligible`
      : `${summary.lastExecutedEligibleSessionCount} 个上次执行候选`,
    english
      ? `${summary.lastExecutedRevokedSessionCount} last revoked`
      : `${summary.lastExecutedRevokedSessionCount} 个上次已撤销`,
    english ? `${summary.executionShortfallCount} shortfall` : `${summary.executionShortfallCount} 个执行短缺`,
    english
      ? `delta ${summary.previewEligibleDeltaCount > 0 ? "+" : ""}${summary.previewEligibleDeltaCount}`
      : `差值 ${summary.previewEligibleDeltaCount > 0 ? "+" : ""}${summary.previewEligibleDeltaCount}`,
    english
      ? `${summary.reviewOnlyScopeCount} review-only scopes`
      : `${summary.reviewOnlyScopeCount} 个仅复核范围`,
    english
      ? `${summary.bulkRevocableScopeCount} actionable scopes`
      : `${summary.bulkRevocableScopeCount} 个可执行范围`,
    english ? `${summary.driftScopeCount} drift scopes` : `${summary.driftScopeCount} 个漂移范围`,
    english
      ? `${summary.currentSessionProtectedScopeCount} current-session protected`
      : `${summary.currentSessionProtectedScopeCount} 个当前会话受保护`,
  ];

  const latestExecutedLabel = formatOptionalDateLabel(summary.latestExecutedAt, english);
  if (latestExecutedLabel) {
    parts.push(english ? `latest executed ${latestExecutedLabel}` : `最近执行于 ${latestExecutedLabel}`);
  }

  return parts.join(" · ");
}

export function formatAuthSessionAnomalyMarker(
  marker: AuthSessionAnomalyMarker,
  english: boolean,
) {
  if (!marker) {
    return english ? "No auth-session anomaly marker recorded." : "当前没有认证会话异常标记。";
  }

  return [
    marker.user.name,
    marker.providerType
      ? formatAuthSessionProvider(marker.providerType, english)
      : english
        ? "Legacy / not recorded"
        : "旧来源 / 未记录",
    marker.sourcePage ?? (english ? "no source page" : "无来源页"),
    marker.activeWorkspaceId
      ? english
        ? `workspace ${marker.activeWorkspaceId}`
        : `工作区 ${marker.activeWorkspaceId}`
      : english
        ? "no active workspace"
        : "无活跃工作区",
    marker.anomalyScopes.length
      ? marker.anomalyScopes.map((scope) => formatAuthSessionAnomalyScope(scope, english)).join(" · ")
      : english
        ? "no anomaly scopes"
        : "无异常范围",
  ].join(" · ");
}
