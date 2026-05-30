export type LifecycleObjective = Readonly<{
  expectedRecoveryPoints: number;
  estimatedEffortMinutes: number;
  estimatedDaysToResolve: number;
  defaultScore: number;
  reasonChain: ReadonlyArray<string>;
}>;

export function buildLifecycleObjective(input: {
  expectedRecoveryPoints: number;
  estimatedEffortMinutes: number;
  estimatedDaysToResolve: number;
  subject: string;
}): LifecycleObjective {
  const expectedRecoveryPoints = Math.max(0, input.expectedRecoveryPoints);
  const estimatedEffortMinutes = Math.max(0, input.estimatedEffortMinutes);
  const estimatedDaysToResolve = Math.max(0, input.estimatedDaysToResolve);

  const recoveryScore = Math.min(1, expectedRecoveryPoints / 100);
  const effortPenalty = Math.min(1, estimatedEffortMinutes / 240);
  const speedPenalty = Math.min(1, estimatedDaysToResolve / 14);
  const defaultScore = recoveryScore * 0.55 - effortPenalty * 0.2 - speedPenalty * 0.25;

  return {
    expectedRecoveryPoints,
    estimatedEffortMinutes,
    estimatedDaysToResolve,
    defaultScore,
    reasonChain: [
      `${input.subject}: expected recovery ${expectedRecoveryPoints}`,
      `estimated effort ${estimatedEffortMinutes} minutes`,
      `estimated days to resolve ${estimatedDaysToResolve}`,
      `default objective score ${defaultScore.toFixed(3)}`,
    ],
  };
}
