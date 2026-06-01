export type WorkerOperationMode = "observer" | "shadow" | "active";

export const DEFAULT_OPERATION_MODE: WorkerOperationMode = "observer";

export type ProposalLike = {
  proposalKind: string;
  requiresApproval: boolean;
  commitment: "suggestion_only";
  reasonChain: ReadonlyArray<string>;
};

export function enforceModeInvariants<T extends ProposalLike>(
  proposal: T,
  mode: WorkerOperationMode,
): T & Readonly<{ mode: WorkerOperationMode; suppressed: boolean }> {
  if (mode === "observer") {
    const isPropose = proposal.proposalKind.startsWith("propose_");
    return {
      ...proposal,
      requiresApproval: false,
      reasonChain: [
        `[observer mode] ${isPropose ? "proposal suppressed" : "read-only observation"}`,
        ...proposal.reasonChain,
      ],
      mode,
      suppressed: isPropose,
    };
  }

  if (mode === "shadow") {
    return {
      ...proposal,
      reasonChain: [
        "[shadow mode] not enqueued for approval; replay evidence only",
        ...proposal.reasonChain,
      ],
      mode,
      suppressed: false,
    };
  }

  return { ...proposal, mode, suppressed: false };
}
