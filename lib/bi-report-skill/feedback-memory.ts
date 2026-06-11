import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/bi-report-skill/missing-table-error";
import type {
  BiReportFeedbackMemoryEntry,
  BiReportFeedbackStatus,
} from "@/lib/bi-report-skill/types";

type StructuredFeedbackNote = {
  note?: string | null;
  isFalsePositive?: boolean | null;
  actionEffective?: boolean | null;
  needsRuleAdjustment?: boolean | null;
};

export async function listRecentBiReportFeedbackMemories(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  take?: number;
}): Promise<BiReportFeedbackMemoryEntry[]> {
  try {
    const rows = await db.biReportFeedbackMemory.findMany({
      where: {
        workspaceId: input.workspaceId,
        skillKey: input.skillKey,
        extensionKey: input.extensionKey ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.take ?? 5,
    });

    return rows.map((row) => {
      const detail = parseStructuredFeedbackNote(row.note);
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        extensionKey: row.extensionKey,
        skillKey: row.skillKey,
        skillVersion: row.skillVersion,
        windowLabel: row.windowLabel,
        feedbackStatus: isFeedbackStatus(row.feedbackStatus) ? row.feedbackStatus : "accepted",
        confirmedCause: row.confirmedCause,
        confirmedAction: row.confirmedAction,
        isFalsePositive: detail.isFalsePositive,
        actionEffective: detail.actionEffective,
        needsRuleAdjustment: detail.needsRuleAdjustment,
        resolutionOutcome: row.resolutionOutcome,
        note: detail.note,
        createdAt: row.createdAt.toISOString(),
      };
    });
  } catch (error) {
    if (isMissingBiReportFeedbackMemoryTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function recordBiReportFeedbackMemory(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  skillVersion: string;
  windowLabel?: string | null;
  feedbackStatus: BiReportFeedbackStatus;
  confirmedCause?: string | null;
  confirmedAction?: string | null;
  isFalsePositive?: boolean | null;
  actionEffective?: boolean | null;
  needsRuleAdjustment?: boolean | null;
  resolutionOutcome?: string | null;
  note?: string | null;
}) {
  try {
    await db.biReportFeedbackMemory.create({
      data: {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        extensionKey: input.extensionKey ?? null,
        skillKey: input.skillKey,
        skillVersion: input.skillVersion,
        windowLabel: input.windowLabel ?? null,
        feedbackStatus: input.feedbackStatus,
        confirmedCause: input.confirmedCause ?? null,
        confirmedAction: input.confirmedAction ?? null,
        resolutionOutcome: input.resolutionOutcome ?? null,
        note: buildStructuredFeedbackNote(input),
      },
    });
  } catch (error) {
    if (isMissingBiReportFeedbackMemoryTableError(error)) {
      return;
    }
    throw error;
  }
}

function isFeedbackStatus(value: string): value is BiReportFeedbackStatus {
  return value === "accepted" || value === "corrected" || value === "rejected";
}

function buildStructuredFeedbackNote(input: {
  note?: string | null;
  isFalsePositive?: boolean | null;
  actionEffective?: boolean | null;
  needsRuleAdjustment?: boolean | null;
}) {
  const payload: StructuredFeedbackNote = {
    note: input.note ?? null,
    isFalsePositive: input.isFalsePositive ?? null,
    actionEffective: input.actionEffective ?? null,
    needsRuleAdjustment: input.needsRuleAdjustment ?? null,
  };

  if (
    payload.note == null &&
    payload.isFalsePositive == null &&
    payload.actionEffective == null &&
    payload.needsRuleAdjustment == null
  ) {
    return null;
  }

  return JSON.stringify(payload);
}

function parseStructuredFeedbackNote(raw: string | null): {
  note: string | null;
  isFalsePositive: boolean | null;
  actionEffective: boolean | null;
  needsRuleAdjustment: boolean | null;
} {
  if (!raw) {
    return {
      note: null,
      isFalsePositive: null,
      actionEffective: null,
      needsRuleAdjustment: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as StructuredFeedbackNote;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        note: normalizeNullableString(parsed.note),
        isFalsePositive: normalizeNullableBoolean(parsed.isFalsePositive),
        actionEffective: normalizeNullableBoolean(parsed.actionEffective),
        needsRuleAdjustment: normalizeNullableBoolean(parsed.needsRuleAdjustment),
      };
    }
  } catch {
    // Keep backward compatibility with legacy plain-text notes.
  }

  return {
    note: raw,
    isFalsePositive: null,
    actionEffective: null,
    needsRuleAdjustment: null,
  };
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

export const __testOnly = {
  buildStructuredFeedbackNote,
  parseStructuredFeedbackNote,
};

function isMissingBiReportFeedbackMemoryTableError(error: unknown) {
  return isMissingTableError(error);
}
