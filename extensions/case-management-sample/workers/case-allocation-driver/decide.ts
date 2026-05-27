export function decideCaseAllocation(input: { queueDepth: number }) {
  return {
    mode: input.queueDepth > 20 ? "review_required" : "ready_for_triage",
  } as const;
}
