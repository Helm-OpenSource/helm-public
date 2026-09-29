#!/usr/bin/env tsx

/**
 * Controlled CLI for the CAIO judgement -> decision-candidate bridge.
 *
 *   npm run caio:inference-decision-candidates -- --workspace-id=<id> --portfolio-ref=opportunity:<id> [--job-id=<id>] [--apply]
 *
 * Without --apply it only lists the completed jobs that still have no candidate. With --apply it writes
 * EVIDENCE_READY DecisionRecords as the AI actor; it never confirms, dispatches or assigns anything.
 * --apply refuses (exit 3) unless HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED is exactly "true".
 * Per-job failures are reported in the outcomes and make the exit code 1 without hiding the other results.
 */

import { db } from "@/lib/db";
import { CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS } from "@/lib/caio-inference/judgement-decision-candidate";
import {
  CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED_ENV,
  CaioJudgementDecisionCandidateError,
  isCaioJudgementDecisionCandidatesEnabled,
  projectCaioInferenceJobDecisionCandidate,
  projectPendingCaioInferenceDecisionCandidates,
  type CaioJudgementDecisionCandidateOutcome,
} from "@/lib/caio-inference/judgement-decision-candidate.service";

type Args = { workspaceId: string; portfolioRef: string; jobId: string | null; apply: boolean };

export function parseCaioInferenceDecisionCandidateArgs(argv: readonly string[]): Args | { invalid: string } {
  const values = new Map<string, string>();
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    const match = /^--(workspace-id|portfolio-ref|job-id)=(.+)$/u.exec(arg);
    if (!match || values.has(match[1])) return { invalid: `unexpected_argument:${arg}` };
    values.set(match[1], match[2]);
  }
  const workspaceId = values.get("workspace-id");
  const portfolioRef = values.get("portfolio-ref");
  if (!workspaceId || !portfolioRef) return { invalid: "workspace_id_and_portfolio_ref_required" };
  return { workspaceId, portfolioRef, jobId: values.get("job-id") ?? null, apply };
}

/** Writing candidates is the switched behaviour; listing what is pending stays available with the switch off. */
export function caioDecisionCandidateApplyRefusal(
  apply: boolean,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return apply && !isCaioJudgementDecisionCandidatesEnabled(env) ? `${CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED_ENV}_not_true` : null;
}

async function main(): Promise<number> {
  const args = parseCaioInferenceDecisionCandidateArgs(process.argv.slice(2));
  if ("invalid" in args) {
    console.error(JSON.stringify({ ok: false, code: "usage", reason: args.invalid }));
    return 2;
  }
  const refusal = caioDecisionCandidateApplyRefusal(args.apply);
  if (refusal) {
    console.error(JSON.stringify({ ok: false, code: "switch_off", reason: refusal }));
    return 3;
  }
  if (!args.apply) {
    const jobs = await db.caioInferenceJob.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: "completed",
        completedAt: { gt: new Date(Date.now() - CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS) },
        ...(args.jobId ? { id: args.jobId } : {}),
      },
      orderBy: { completedAt: "desc" },
      take: 20,
      select: { id: true },
    });
    const keys = jobs.map((job) => `caio-inference-decision:${job.id}`);
    const projected = new Set(
      (await db.decisionRecord.findMany({
        where: { workspaceId: args.workspaceId, decisionKey: { in: keys } },
        select: { decisionKey: true },
      })).map((record) => record.decisionKey),
    );
    console.log(JSON.stringify({
      ok: true,
      apply: false,
      pendingJobIds: jobs.map((job) => job.id).filter((id) => !projected.has(`caio-inference-decision:${id}`)),
    }));
    return 0;
  }
  let outcomes: CaioJudgementDecisionCandidateOutcome[];
  if (args.jobId) {
    try {
      outcomes = [await projectCaioInferenceJobDecisionCandidate({ workspaceId: args.workspaceId, jobId: args.jobId, portfolioRef: args.portfolioRef })];
    } catch (error) {
      if (!(error instanceof CaioJudgementDecisionCandidateError)) throw error;
      outcomes = [{ kind: "failed", jobId: args.jobId, code: error.code }];
    }
  } else {
    outcomes = await projectPendingCaioInferenceDecisionCandidates({ workspaceId: args.workspaceId, portfolioRef: args.portfolioRef });
  }
  const failed = outcomes.some((outcome) => outcome.kind === "failed");
  console.log(JSON.stringify({ ok: !failed, apply: true, outcomes }));
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "failed";
      console.error(JSON.stringify({ ok: false, code }));
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
