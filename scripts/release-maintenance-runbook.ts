export type StepKind = "manual" | "verify" | "orchestrate";

export type StepSpec = {
  readonly id: string;
  readonly title: string;
  readonly kind: StepKind;
};

export type RunbookCommandReceipt = {
  command: string;
  exitCode: number;
  capturedAt: string;
};

export type StepEvidence = {
  stepId: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  notes: string[];
  commandsRun: RunbookCommandReceipt[];
};

export type ReleaseMaintenanceRunbookState = {
  runId: string;
  startedAt: string;
  currentStepIndex: number;
  ownerConfirmedAt: string | null;
  dryRun: boolean;
  steps: StepEvidence[];
};

export const STEPS: readonly StepSpec[] = [
  { id: "preflight", title: "Preflight receipts", kind: "verify" },
  { id: "rotation-confirm", title: "Credential rotation confirmation", kind: "manual" },
  { id: "rehearsal-mirror", title: "Rehearsal mirror build", kind: "orchestrate" },
  { id: "collaborator-freeze", title: "Collaborator freeze notice", kind: "manual" },
  { id: "real-rewrite", title: "Real history rewrite", kind: "manual" },
  { id: "force-push", title: "Protected force-push", kind: "manual" },
  { id: "post-rewrite-verify", title: "Post-rewrite verification", kind: "verify" },
  { id: "post-rewrite-grep", title: "Post-rewrite grep receipts", kind: "verify" },
  { id: "mirror-build", title: "Public mirror build", kind: "orchestrate" },
  { id: "mirror-verify", title: "Public mirror verify", kind: "verify" },
  { id: "clean-receipt", title: "Clean receipt generation", kind: "orchestrate" },
  { id: "release-check", title: "Release readiness check", kind: "verify" },
  { id: "go-nogo", title: "Final Go/No-Go signoff", kind: "manual" },
] as const;

export function buildFreshRunbookState(
  runId: string,
  dryRun: boolean,
  startedAt = new Date().toISOString(),
): ReleaseMaintenanceRunbookState {
  return {
    runId,
    startedAt,
    currentStepIndex: 0,
    ownerConfirmedAt: null,
    dryRun,
    steps: STEPS.map((step) => ({
      stepId: step.id,
      title: step.title,
      status: "pending",
      startedAt: null,
      finishedAt: null,
      notes: [],
      commandsRun: [],
    })),
  };
}
