export function decideCaseStewardship(input: { unresolvedDays: number }) {
  return {
    mode: input.unresolvedDays > 3 ? "review_required" : "monitor",
  } as const;
}
