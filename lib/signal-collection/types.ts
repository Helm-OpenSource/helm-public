export type SignalCollectionEffect =
  | "external_read"
  | "internal_signal_write"
  | "notification_send"
  | "tenant_case_assignment_write";

export type SignalCollectionJobKind = "signal_collection" | "tenant_operation";

export type SignalCollectionTarget = {
  key: string;
  label?: string;
  workspaceId?: string;
  workspaceSlug?: string;
  rentCode?: string;
  metadata?: Record<string, unknown>;
};

export type SignalCollectionTargetResult = {
  status: "success" | "failed" | "skipped";
  message?: string;
  signalCount?: number;
  failureCount?: number;
  details?: unknown;
};

export type SignalCollectionRunContext = {
  jobKey: string;
  targetKey: string;
  traceId: string;
  requestedAt: Date;
  windowDate: string;
  source: "api" | "scheduler" | "compatibility-wrapper" | "test";
};

export type SignalCollectionStartCheck =
  | { ok: true }
  | { ok: false; reason: string };

export type SignalCollectionSchedule = {
  timeEnvKey: string;
  defaultCron: string;
  timezoneEnvKey?: string;
  defaultTimezone: string;
};

export type SignalCollectionJob = {
  key: string;
  tenantKey: string;
  extensionKey: string;
  label: string;
  kind: SignalCollectionJobKind;
  enabled: () => boolean;
  schedule: SignalCollectionSchedule;
  allowedEffects: readonly SignalCollectionEffect[];
  canStart?: () => SignalCollectionStartCheck;
  resolveTargets: () => Promise<SignalCollectionTarget[]>;
  runTarget: (
    target: SignalCollectionTarget,
    context: SignalCollectionRunContext,
  ) => Promise<SignalCollectionTargetResult>;
};

export type SignalCollectionTargetRunSummary = {
  jobKey: string;
  targetKey: string;
  status: SignalCollectionTargetResult["status"];
  traceId: string;
  message?: string;
  signalCount: number;
  failureCount: number;
  details?: unknown;
};

export type SignalCollectionJobRunSummary = {
  jobKey: string;
  status: "success" | "failed" | "skipped";
  targetCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  runs: SignalCollectionTargetRunSummary[];
  message?: string;
};

export type SignalCollectionRunSummary = {
  ok: boolean;
  requestedAt: string;
  windowDate: string;
  jobCount: number;
  targetCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  jobs: SignalCollectionJobRunSummary[];
};
