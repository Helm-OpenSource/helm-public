import { isClosedStage } from "../../signals/case/case-mapper";
import {
  DEFAULT_OPERATION_MODE,
  enforceModeInvariants,
  type WorkerOperationMode,
} from "../worker-modes";
import type {
  RecentCaseAction,
  StewardshipDecideInput,
  StewardshipDecideReport,
  StewardshipFlag,
  StewardshipFlagKind,
  StewardshipRosterEntry,
  StewardshipStatus,
} from "./types";

const WORKER_ID = "case-stewardship-driver-v0" as const;

export function decideStewardship(
  input: StewardshipDecideInput,
): StewardshipDecideReport {
  const mode: WorkerOperationMode = input.operationMode ?? DEFAULT_OPERATION_MODE;
  const activeCases = input.cases.filter((caseRecord) => !isClosedStage(caseRecord.stage));
  const actionsByCase = groupRecentActions(input.recentActions ?? []);
  const today = parseDate(input.today);

  const roster: StewardshipRosterEntry[] = [];
  const flags: StewardshipFlag[] = [];

  for (const caseRecord of activeCases) {
    const latestAction = actionsByCase.get(caseRecord.caseId)?.[0] ?? null;
    const referenceDate = latestAction?.observedDate ?? caseRecord.observedDate;
    const idleDays = Math.max(0, diffDays(parseDate(referenceDate), today));
    const status = deriveStatus(idleDays, caseRecord.stage);
    const reasonChain = [
      `stage=${caseRecord.stage}`,
      `latest action=${latestAction?.actionKind ?? "none"}`,
      `idle days=${idleDays}`,
    ];

    roster.push({
      caseId: caseRecord.caseId,
      ownerRefId: caseRecord.ownerRefId,
      idleDays,
      status,
      reasonChain,
    });

    const flagKind = chooseFlag(caseRecord.stage, status);
    if (flagKind) {
      flags.push(
        enforceModeInvariants(
          {
            workerId: WORKER_ID,
            proposalKind: flagKind,
            proposalKey: `stewardship:${flagKind}:${caseRecord.caseId}`,
            caseId: caseRecord.caseId,
            ownerRefId: caseRecord.ownerRefId,
            commitment: "suggestion_only" as const,
            requiresApproval: false as const,
            reasonChain,
          },
          mode,
        ),
      );
    }
  }

  return {
    roster,
    flags,
    stats: {
      activeCases: roster.length,
      needsAttention: roster.filter((entry) => entry.status === "needs_attention").length,
      stuck: roster.filter((entry) => entry.status === "stuck").length,
      dropped: roster.filter((entry) => entry.status === "dropped").length,
    },
    mode,
  };
}

function groupRecentActions(
  actions: ReadonlyArray<RecentCaseAction>,
): Map<string, RecentCaseAction[]> {
  const grouped = new Map<string, RecentCaseAction[]>();
  for (const action of actions) {
    const next = grouped.get(action.caseId) ?? [];
    next.push(action);
    grouped.set(action.caseId, next);
  }
  for (const next of grouped.values()) {
    next.sort((left, right) => right.observedDate.localeCompare(left.observedDate));
  }
  return grouped;
}

function deriveStatus(idleDays: number, stage: string): StewardshipStatus {
  if (idleDays >= 10) return "dropped";
  if (idleDays >= 5) return "stuck";
  if (stage === "evidence_gap" || idleDays >= 3) return "needs_attention";
  return "on_track";
}

function chooseFlag(
  stage: string,
  status: StewardshipStatus,
): StewardshipFlagKind | null {
  if (status === "dropped") return "flag_dropped_case";
  if (status === "stuck") return "flag_idle_case";
  if (stage === "evidence_gap") return "flag_evidence_gap";
  return null;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function diffDays(left: Date, right: Date): number {
  return Math.floor((right.getTime() - left.getTime()) / 86_400_000);
}
