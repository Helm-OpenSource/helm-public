import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/lib/db";
import {
  getEngineeringDeliveryReview,
  type EngineeringDeliveryReview,
  type EngineeringDeliveryReviewFreshness,
} from "@/lib/reports/engineering-delivery-review";
import { resolveHelmReservedWorkspace } from "@/lib/workspace-reserved";

const execFileAsync = promisify(execFile);

const GIT_BUFFER_BYTES = 12 * 1024 * 1024;
const STALE_RUNNING_WINDOW_MS = 3 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 28;

export const ENGINEERING_REVIEW_CRON_TZ_FALLBACK = "Asia/Ulaanbaatar";
export const ENGINEERING_REVIEW_GIT_REVISION_FALLBACK = "main";

let refreshInProcess = false;

type SnapshotPayload = {
  zh: EngineeringDeliveryReview;
  en: EngineeringDeliveryReview;
};

export type EngineeringDeliveryRefreshTrigger = "cron" | "manual" | "startup";

export type EngineeringDeliveryRefreshResult =
  | {
      ok: true;
      status: "SUCCESS";
      workspaceId: string;
      runId: string;
      snapshotId: string;
      sourceRevision: string | null;
      snapshotDate: string;
    }
  | {
      ok: true;
      status: "SKIPPED";
      reason: string;
    }
  | {
      ok: false;
      status: "FAILED";
      workspaceId?: string;
      runId?: string;
      error: string;
    };

export async function runEngineeringDeliveryDailyRefresh(input?: {
  days?: number;
  now?: Date;
  revision?: string;
  timezone?: string;
  trigger?: EngineeringDeliveryRefreshTrigger;
}): Promise<EngineeringDeliveryRefreshResult> {
  if (refreshInProcess) {
    return {
      ok: true,
      status: "SKIPPED",
      reason: "process_lock_active",
    };
  }

  refreshInProcess = true;
  try {
    const workspace = await resolveHelmReservedWorkspace();
    if (!workspace) {
      return {
        ok: true,
        status: "SKIPPED",
        reason: "reserved_workspace_unavailable",
      };
    }

    const now = input?.now ?? new Date();
    const days = input?.days ?? DEFAULT_WINDOW_DAYS;
    const timezone = input?.timezone?.trim() || ENGINEERING_REVIEW_CRON_TZ_FALLBACK;
    const requestedRevision = input?.revision?.trim() || ENGINEERING_REVIEW_GIT_REVISION_FALLBACK;
    const revision = await resolveRefreshRevision(requestedRevision, process.cwd());
    const snapshotDateKey = toDateKey(now, timezone);
    const snapshotDate = fromDateKey(snapshotDateKey);
    const snapshotTablesReady = await hasSnapshotTables();

    if (!snapshotTablesReady) {
      return {
        ok: true,
        status: "SKIPPED",
        reason: "snapshot_tables_missing",
      };
    }

    const running = await db.engineeringDeliveryReviewRefreshRun.findFirst({
      where: {
        workspaceId: workspace.id,
        status: "RUNNING",
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
        startedAt: true,
      },
    });

    if (running) {
      if (now.getTime() - running.startedAt.getTime() <= STALE_RUNNING_WINDOW_MS) {
        return {
          ok: true,
          status: "SKIPPED",
          reason: "db_lock_active",
        };
      }

      await db.engineeringDeliveryReviewRefreshRun.update({
        where: {
          id: running.id,
        },
        data: {
          status: "FAILED",
          finishedAt: now,
          errorMessage: "Marked stale after exceeding refresh running window.",
        },
      });
    }

    const run = await db.engineeringDeliveryReviewRefreshRun.create({
      data: {
        workspaceId: workspace.id,
        snapshotDate,
        windowDays: days,
        status: "RUNNING",
        sourceRevision: null,
        trigger: input?.trigger ?? "cron",
        startedAt: now,
      },
      select: {
        id: true,
      },
    });

    try {
      const sourceRevision = await resolveSourceRevision(revision, process.cwd());
      const [zhReview, enReview] = await Promise.all([
        getEngineeringDeliveryReview({
          days,
          english: false,
          cwd: process.cwd(),
          revision,
        }),
        getEngineeringDeliveryReview({
          days,
          english: true,
          cwd: process.cwd(),
          revision,
        }),
      ]);

      if (zhReview.availability === "UNAVAILABLE" || enReview.availability === "UNAVAILABLE") {
        throw new Error("engineering delivery review source unavailable in current runtime");
      }

      const payload: SnapshotPayload = {
        zh: zhReview,
        en: enReview,
      };

      const snapshot = await db.engineeringDeliveryReviewSnapshot.upsert({
        where: {
          workspaceId_snapshotDate_windowDays: {
            workspaceId: workspace.id,
            snapshotDate,
            windowDays: days,
          },
        },
        create: {
          workspaceId: workspace.id,
          snapshotDate,
          windowDays: days,
          payloadJson: JSON.stringify(payload),
          sourceRevision,
          generatedAt: now,
        },
        update: {
          payloadJson: JSON.stringify(payload),
          sourceRevision,
          generatedAt: now,
        },
        select: {
          id: true,
        },
      });

      await db.engineeringDeliveryReviewRefreshRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: "SUCCESS",
          finishedAt: now,
          snapshotId: snapshot.id,
          sourceRevision,
          errorMessage: null,
        },
      });

      return {
        ok: true,
        status: "SUCCESS",
        workspaceId: workspace.id,
        runId: run.id,
        snapshotId: snapshot.id,
        sourceRevision,
        snapshotDate: snapshotDateKey,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await db.engineeringDeliveryReviewRefreshRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: "FAILED",
          finishedAt: now,
          errorMessage,
        },
      });

      return {
        ok: false,
        status: "FAILED",
        workspaceId: workspace.id,
        runId: run.id,
        error: errorMessage,
      };
    }
  } finally {
    refreshInProcess = false;
  }
}

export async function getLatestEngineeringDeliverySnapshot(input: {
  english: boolean;
  now?: Date;
  timezone?: string;
  days?: number;
}): Promise<EngineeringDeliveryReview> {
  const workspace = await resolveHelmReservedWorkspace();
  const days = input.days ?? DEFAULT_WINDOW_DAYS;

  if (!workspace) {
    return buildMissingSnapshotReview({
      english: input.english,
      days,
      reason: "reserved_workspace_unavailable",
    });
  }

  const snapshotTablesReady = await hasSnapshotTables();
  if (!snapshotTablesReady) {
    return buildSchemaFallbackLiveReview({
      english: input.english,
      days,
    });
  }

  const [snapshot, latestRun] = await Promise.all([
    db.engineeringDeliveryReviewSnapshot.findFirst({
      where: {
        workspaceId: workspace.id,
        windowDays: days,
      },
      orderBy: [
        {
          snapshotDate: "desc",
        },
        {
          generatedAt: "desc",
        },
      ],
      select: {
        id: true,
        payloadJson: true,
        sourceRevision: true,
        generatedAt: true,
        snapshotDate: true,
      },
    }),
    db.engineeringDeliveryReviewRefreshRun.findFirst({
      where: {
        workspaceId: workspace.id,
        windowDays: days,
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
      },
    }),
  ]);

  if (!snapshot) {
    return buildMissingSnapshotReview({
      english: input.english,
      days,
      reason: latestRun?.status === "FAILED" ? "refresh_failed" : "snapshot_missing",
      latestRunStatus: latestRun?.status ?? null,
    });
  }

  const payload = parseSnapshotPayload(snapshot.payloadJson);
  if (!payload) {
    return buildMissingSnapshotReview({
      english: input.english,
      days,
      reason: "snapshot_payload_invalid",
    });
  }

  const selected = input.english ? payload.en : payload.zh;
  const now = input.now ?? new Date();
  const timezone = input.timezone?.trim() || ENGINEERING_REVIEW_CRON_TZ_FALLBACK;
  const todayKey = toDateKey(now, timezone);
  const snapshotKey = toDateKey(snapshot.snapshotDate, timezone);
  const runKey = latestRun ? toDateKey(latestRun.startedAt, timezone) : null;
  const stale = snapshotKey !== todayKey;
  const failedToday = latestRun?.status === "FAILED" && runKey === todayKey;

  const freshness: EngineeringDeliveryReviewFreshness = {
    mode: "SNAPSHOT",
    generatedAt: snapshot.generatedAt.toISOString(),
    sourceRevision: snapshot.sourceRevision ?? null,
    stale,
    note: buildFreshnessNote({
      english: input.english,
      stale,
      failedToday,
      generatedAt: snapshot.generatedAt,
      errorMessage: latestRun?.errorMessage ?? null,
    }),
  };

  return {
    ...selected,
    freshness,
  };
}

async function resolveSourceRevision(revision: string, cwd: string) {
  try {
    const repoRoot = await resolveRepoRoot(cwd);

    const { stdout } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", revision], {
      cwd,
      maxBuffer: GIT_BUFFER_BYTES,
    });

    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function resolveRefreshRevision(revision: string, cwd: string) {
  const normalized = revision.trim();
  if (!normalized) {
    return ENGINEERING_REVIEW_GIT_REVISION_FALLBACK;
  }

  if (normalized !== "main" && normalized !== "origin/main") {
    return normalized;
  }

  const repoRoot = await resolveRepoRoot(cwd);
  await execFileAsync("git", ["-C", repoRoot, "fetch", "origin", "main", "--prune"], {
    cwd,
    maxBuffer: GIT_BUFFER_BYTES,
  });

  return "origin/main";
}

async function resolveRepoRoot(cwd: string) {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    maxBuffer: GIT_BUFFER_BYTES,
  });
  return stdout.trim();
}

function parseSnapshotPayload(payloadJson: string): SnapshotPayload | null {
  try {
    const parsed = JSON.parse(payloadJson) as Partial<SnapshotPayload>;
    if (!parsed || !parsed.zh || !parsed.en) {
      return null;
    }

    return {
      zh: parsed.zh,
      en: parsed.en,
    };
  } catch {
    return null;
  }
}

function buildMissingSnapshotReview(input: {
  english: boolean;
  days: number;
  reason: "snapshot_missing" | "refresh_failed" | "snapshot_payload_invalid" | "reserved_workspace_unavailable";
  latestRunStatus?: string | null;
}): EngineeringDeliveryReview {
  const windowLabel = input.english ? `Last ${input.days} days` : `最近 ${input.days} 天`;

  const summaryByReason: Record<string, string> = {
    snapshot_missing: input.english
      ? "Daily snapshot is not available yet. Run the refresh job before opening this review block."
      : "每日快照暂未生成，请先执行刷新任务后再查看该区块。",
    refresh_failed: input.english
      ? "The latest refresh run failed before writing a successful snapshot."
      : "最近一次刷新在写入成功快照前失败。",
    snapshot_payload_invalid: input.english
      ? "Snapshot payload could not be parsed, so this block stays downgraded."
      : "快照内容无法解析，因此该区块保持降级。",
    reserved_workspace_unavailable: input.english
      ? "Helm reserved workspace is unavailable, so this block cannot load snapshot data."
      : "Helm reserved workspace 当前不可用，因此无法读取该区块快照。",
  };

  const latestRunNote = input.latestRunStatus
    ? input.english
      ? `Latest run status: ${input.latestRunStatus}.`
      : `最近任务状态：${input.latestRunStatus}。`
    : input.english
      ? ""
      : "";

  return {
    availability: "EMPTY",
    repoLabel: "helm2026-main",
    windowLabel,
    headline: input.english
      ? "Engineering delivery snapshot is not ready yet."
      : "工程交付快照尚未就绪。",
    summary: `${summaryByReason[input.reason]} ${latestRunNote}`.trim(),
    sourceNote: input.english
      ? "Source: reserved workspace daily snapshot store."
      : "数据源：reserved workspace 每日快照存储。",
    boundaryNote: input.english
      ? "This block does not backfill or fabricate engineering facts when no valid snapshot exists."
      : "当没有有效快照时，该区块不会补造或伪造工程事实。",
    snapshot: {
      objectState: input.english ? "No snapshot yet" : "暂无快照",
      blocker: input.english
        ? "Daily refresh has not produced a valid snapshot for this window."
        : "每日刷新尚未产出该窗口的有效快照。",
      pendingDecision: input.english
        ? "Confirm scheduler runtime health and refresh execution path."
        : "确认调度运行健康度与刷新执行链路。",
      nextAction: input.english
        ? "Run refresh and verify snapshot storage status."
        : "执行刷新并确认快照写入状态。",
    },
    connections: [],
    contributors: [],
    collaboration: {
      summary: input.english
        ? "Collaboration signals will appear after the first successful snapshot."
        : "首个成功快照写入后，这里才会出现协同信号。",
      hotspots: [],
      risks: [],
      overlapPairs: [],
    },
    suggestions: [],
  };
}

async function buildSchemaFallbackLiveReview(input: {
  english: boolean;
  days: number;
}): Promise<EngineeringDeliveryReview> {
  const revision = process.env.ENGINEERING_REVIEW_GIT_REVISION?.trim() || ENGINEERING_REVIEW_GIT_REVISION_FALLBACK;
  const live = await getEngineeringDeliveryReview({
    days: input.days,
    english: input.english,
    cwd: process.cwd(),
    revision,
  });

  return {
    ...live,
    freshness: {
      mode: "LIVE",
      generatedAt: new Date().toISOString(),
      sourceRevision: live.freshness?.sourceRevision ?? null,
      stale: false,
      note: input.english
        ? "Snapshot tables are not migrated yet; temporarily falling back to live git calculation."
        : "快照表尚未迁移，当前临时回退为实时 git 计算。",
    },
  };
}

async function hasSnapshotTables() {
  try {
    await Promise.all([
      db.engineeringDeliveryReviewSnapshot.findFirst({
        select: {
          id: true,
        },
      }),
      db.engineeringDeliveryReviewRefreshRun.findFirst({
        select: {
          id: true,
        },
      }),
    ]);
    return true;
  } catch (error) {
    if (isTableMissingError(error)) {
      return false;
    }

    throw error;
  }
}

function isTableMissingError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : null;
  if (code === "P2021") {
    return true;
  }

  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return /does not exist in the current database/i.test(message) || /table .* does not exist/i.test(message);
}

function buildFreshnessNote(input: {
  english: boolean;
  stale: boolean;
  failedToday: boolean;
  generatedAt: Date;
  errorMessage: string | null;
}) {
  if (!input.stale) {
    return input.english
      ? "Refreshed today from the scheduled daily snapshot."
      : "今日已按计划刷新为最新每日快照。";
  }

  if (input.failedToday) {
    return input.english
      ? `Today's refresh failed, so the page keeps the latest successful snapshot (${input.generatedAt.toISOString()}).${input.errorMessage ? ` Error: ${input.errorMessage}` : ""}`
      : `今日刷新失败，当前展示最近一次成功快照（${input.generatedAt.toISOString()}）。${input.errorMessage ? `错误：${input.errorMessage}` : ""}`;
  }

  return input.english
    ? `Latest successful snapshot is from ${input.generatedAt.toISOString()} and may be stale.`
    : `最近一次成功快照时间为 ${input.generatedAt.toISOString()}，数据可能已过期。`;
}

function toDateKey(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return value.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
