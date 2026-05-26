export const helmControlPlanes = [
  "source-ingestion",
  "belief-runtime",
  "operator-governance",
  "execution-commitment",
] as const;

export type HelmControlPlane = (typeof helmControlPlanes)[number];

export const helmCognitiveObjectKinds = [
  "belief",
  "goal",
  "committed-intention",
  "operating-gap",
] as const;

export type HelmCognitiveObjectKind = (typeof helmCognitiveObjectKinds)[number];

export type HelmContractStatus = "established" | "formed-needs-next-layer";

export type HelmControlPlaneDefinition = {
  plane: HelmControlPlane;
  label: string;
  summary: string;
  boundaryNotes: readonly string[];
};

export type HelmCognitiveObjectDefinition = {
  kind: HelmCognitiveObjectKind;
  label: string;
  plane: HelmControlPlane;
  status: HelmContractStatus;
  summary: string;
  currentRepresentations: readonly string[];
  requiredFields: readonly string[];
  boundaryNotes: readonly string[];
};

export const helmControlPlaneDefinitions: readonly HelmControlPlaneDefinition[] = [
  {
    plane: "source-ingestion",
    label: "Source / Ingestion",
    summary:
      "接收会议、邮件、CRM、报表、知识库与连接器输入，保留原始 provenance，不直接跨过运行时与 governance 进入执行层。",
    boundaryNotes: [
      "保留源头 provenance",
      "不直接形成高风险外部动作",
    ],
  },
  {
    plane: "belief-runtime",
    label: "Belief / Runtime",
    summary:
      "承载事实、冲突、置信度、payload、notebook 与 world model，输出系统当前相信什么为真。",
    boundaryNotes: [
      "允许更新事实与冲突姿态",
      "不直接拥有 execution权限",
    ],
  },
  {
    plane: "operator-governance",
    label: "Operator / Governance",
    summary:
      "承载复核、审批、审计、support 资料 与 exception姿态，维持判断优先与复核优先。",
    boundaryNotes: [
      "允许复核 / 审批 / escalate",
      "不直接放大执行权限",
    ],
  },
  {
    plane: "execution-commitment",
    label: "Execution / Commitment",
    summary:
      "承载已批准或已正式推进的动作、责任人、SLA、阻塞与 revocation姿态。",
    boundaryNotes: [
      "no auto-send",
      "no broad auto-write",
      "no execution-authority expansion",
    ],
  },
] as const;

export const helmCognitiveObjectDefinitions: readonly HelmCognitiveObjectDefinition[] =
  [
    {
      kind: "belief",
      label: "Belief",
      plane: "belief-runtime",
      status: "formed-needs-next-layer",
      summary:
        "系统当前认为为真的事实、冲突、上下文与置信度层。",
      currentRepresentations: [
        "MemoryFact",
        "TruthConflict",
        "WorldModelSnapshot",
        "MemoryItem",
      ],
      requiredFields: [
        "source",
        "freshness",
        "confidence",
        "conflict posture",
        "scope",
        "evidence refs",
      ],
      boundaryNotes: [
        "当前仍是多对象映射",
        "尚未形成单一 权威 Belief object",
      ],
    },
    {
      kind: "goal",
      label: "Goal",
      plane: "belief-runtime",
      status: "formed-needs-next-layer",
      summary:
        "系统当前希望推动达成的目标层。",
      currentRepresentations: [
        "MeetingNote.meetingGoal",
        "HandoffPacket.goal",
        "ProblemSpace.title + nextStep",
      ],
      requiredFields: [
        "goal text",
        "scope",
        "owner",
        "KPI / outcome link",
        "evidence requirement",
        "status",
      ],
      boundaryNotes: [
        "当前仍是多处表达",
        "尚未形成单一 权威 Goal object",
      ],
    },
    {
      kind: "committed-intention",
      label: "Committed Intention",
      plane: "execution-commitment",
      status: "established",
      summary:
        "系统已经批准并正式推进的动作层。",
      currentRepresentations: [
        "Commitment",
        "ApprovalRequest",
        "ActionItem",
      ],
      requiredFields: [
        "owner",
        "SLA",
        "blockers",
        "revocation posture",
        "evidence link",
        "status",
      ],
      boundaryNotes: [
        "只记录已批准或已正式推进的动作",
        "继续保留 no auto-send / no broad auto-write",
      ],
    },
    {
      kind: "operating-gap",
      label: "OperatingGap",
      plane: "operator-governance",
      status: "formed-needs-next-layer",
      summary:
        "系统已识别的经营缺口层。",
      currentRepresentations: [
        "TruthConflict",
        "ProblemSpace",
        "CompositionFailure",
      ],
      requiredFields: [
        "gap type",
        "severity",
        "missing field or unresolved state",
        "owner hint",
        "evidence refs",
        "escalation posture",
      ],
      boundaryNotes: [
        "当前仍是多对象映射",
        "尚未形成单一 权威 OperatingGap object",
      ],
    },
  ] as const;

export function getHelmCognitiveObjectDefinition(
  kind: HelmCognitiveObjectKind,
): HelmCognitiveObjectDefinition {
  const definition = helmCognitiveObjectDefinitions.find((item) => item.kind === kind);
  if (!definition) {
    throw new Error(`Unknown cognitive object kind: ${kind}`);
  }
  return definition;
}

export function validateHelmCognitiveObjectContract(): void {
  const planeOrder = helmControlPlaneDefinitions.map((item) => item.plane);
  if (planeOrder.join(",") !== helmControlPlanes.join(",")) {
    throw new Error("Helm control plane order drifted from the frozen contract.");
  }

  const seenKinds = new Set<string>();
  for (const definition of helmCognitiveObjectDefinitions) {
    if (seenKinds.has(definition.kind)) {
      throw new Error(`Duplicate cognitive object definition: ${definition.kind}`);
    }
    seenKinds.add(definition.kind);

    if (!helmControlPlanes.includes(definition.plane)) {
      throw new Error(`Unknown control plane on ${definition.kind}: ${definition.plane}`);
    }

    if (!definition.requiredFields.length) {
      throw new Error(`Missing required fields for ${definition.kind}`);
    }

    if (!definition.currentRepresentations.length) {
      throw new Error(`Missing current representations for ${definition.kind}`);
    }
  }

  const executionPlane = helmControlPlaneDefinitions.find(
    (item) => item.plane === "execution-commitment",
  );
  if (
    !executionPlane ||
    !executionPlane.boundaryNotes.includes("no auto-send") ||
    !executionPlane.boundaryNotes.includes("no broad auto-write") ||
    !executionPlane.boundaryNotes.includes("no execution-authority expansion")
  ) {
    throw new Error(
      "Execution / Commitment plane must preserve no auto-send / no broad auto-write / no execution-authority expansion.",
    );
  }

  const committedIntention = getHelmCognitiveObjectDefinition("committed-intention");
  if (committedIntention.plane !== "execution-commitment") {
    throw new Error("Committed Intention must stay on the execution / commitment plane.");
  }
}
