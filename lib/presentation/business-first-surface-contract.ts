export type BusinessFirstSurfaceSnapshot = {
  objectState: string;
  blocker: string;
  pendingDecision: string;
  nextAction: string;
};

export function getBusinessFirstSummaryLabels(english: boolean) {
  return {
    objectState: english ? "Object state" : "对象状态",
    blocker: english ? "Blocker" : "阻塞",
    pendingDecision: english ? "Pending decision" : "待决策",
    nextAction: english ? "Next action" : "下一步动作",
  } as const;
}

export function buildBusinessFirstSummaryItems({
  english,
  snapshot,
}: {
  english: boolean;
  snapshot: BusinessFirstSurfaceSnapshot;
}) {
  const labels = getBusinessFirstSummaryLabels(english);

  return [
    {
      label: labels.objectState,
      value: snapshot.objectState,
    },
    {
      label: labels.blocker,
      value: snapshot.blocker,
    },
    {
      label: labels.pendingDecision,
      value: snapshot.pendingDecision,
    },
    {
      label: labels.nextAction,
      value: snapshot.nextAction,
    },
  ] as const;
}
