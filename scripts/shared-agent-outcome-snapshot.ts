import { readFileSync } from "node:fs";
import path from "node:path";

type SignalState = "available" | "not-in-scope" | "not-yet-measurable";

type SignalKey =
  | "authorityCue"
  | "attentionCue"
  | "resurfacingCues"
  | "progressTrace"
  | "governanceCues"
  | "internalExecutionCues"
  | "externalDraftReviewHandoffCues"
  | "postSendOutcomeCues"
  | "operationalQueueCardSharedCues";

type SurfaceSnapshot = {
  surface: string;
  role: string;
  manualPilotEvaluation:
    | "cue-complete-runtime-smoke-required"
    | "not-ready-yet";
  signals: Record<SignalKey, SignalState>;
};

type SignalSpec = {
  state?: SignalState;
  snippets?: string[];
};

type SurfaceSpec = {
  surface: string;
  role: string;
  files: string[];
  signals: Record<SignalKey, SignalSpec>;
};

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function includesAll(haystack: string, snippets: string[]) {
  return snippets.every((snippet) => haystack.includes(snippet));
}

function resolveSignalState(
  haystack: string,
  spec: SignalSpec,
): SignalState {
  if (spec.state) {
    return spec.state;
  }

  if (!spec.snippets?.length) {
    return "not-yet-measurable";
  }

  return includesAll(haystack, spec.snippets)
    ? "available"
    : "not-yet-measurable";
}

function formatSignalLabel(key: SignalKey) {
  switch (key) {
    case "authorityCue":
      return "authority cue";
    case "attentionCue":
      return "attention cue";
    case "resurfacingCues":
      return "since last seen / resurfaced because";
    case "progressTrace":
      return "progress trace";
    case "governanceCues":
      return "governance / review posture";
    case "internalExecutionCues":
      return "internal execution cues";
    case "externalDraftReviewHandoffCues":
      return "external draft / review / handoff cues";
    case "postSendOutcomeCues":
      return "post-send outcome cues";
    case "operationalQueueCardSharedCues":
      return "operational queue/card shared cues";
  }
}

function formatState(state: SignalState) {
  switch (state) {
    case "available":
      return "available";
    case "not-in-scope":
      return "not in scope on this surface";
    case "not-yet-measurable":
      return "not yet measurable";
  }
}

const surfaces: SurfaceSpec[] = [
  {
    surface: "Customer success detail",
    role: "richest proving ground",
    files: [
      "features/customer-success-handoff/detail-model.ts",
      "features/customer-success-handoff/detail-view.tsx",
    ],
    signals: {
      authorityCue: { snippets: ["authorityState", "buildAuthoritySummary"] },
      attentionCue: { snippets: ["attentionState", "buildAttentionSummary"] },
      resurfacingCues: {
        snippets: ["Since last seen", "Why this is back now"],
      },
      progressTrace: { snippets: ["Progress trace"] },
      governanceCues: {
        snippets: [
          "What stays available now",
          "external-send-disabled",
          "commitment-disabled",
        ],
      },
      internalExecutionCues: {
        snippets: ["user-approved-to-execute", "executed-internally"],
      },
      externalDraftReviewHandoffCues: {
        snippets: ["review-pending", "handoff-to-human-sender"],
      },
      postSendOutcomeCues: {
        snippets: ["awaiting-external-outcome", "CustomerSuccessPostSendOutcomeCue"],
      },
      operationalQueueCardSharedCues: { state: "not-in-scope" },
    },
  },
  {
    surface: "Review-request detail",
    role: "first thin adjacent adoption",
    files: [
      "features/inbox-followup-review-request/detail-model.ts",
      "features/inbox-followup-review-request/detail-view.tsx",
    ],
    signals: {
      authorityCue: { snippets: ["AgentAuthorityState"] },
      attentionCue: { snippets: ["AgentAttentionState"] },
      resurfacingCues: {
        snippets: ["Since last seen", "Why this is back now"],
      },
      progressTrace: { snippets: ["Progress trace"] },
      governanceCues: {
        snippets: ["policyLabel", "policyItems", "boundaryLabel"],
      },
      internalExecutionCues: { state: "not-in-scope" },
      externalDraftReviewHandoffCues: { state: "not-in-scope" },
      postSendOutcomeCues: { state: "not-in-scope" },
      operationalQueueCardSharedCues: { state: "not-in-scope" },
    },
  },
  {
    surface: "Success-check detail",
    role: "second thin adjacent adoption",
    files: [
      "features/success-check/detail-model.ts",
      "features/success-check/detail-view.tsx",
    ],
    signals: {
      authorityCue: { snippets: ["AgentAuthorityState"] },
      attentionCue: { snippets: ["AgentAttentionState"] },
      resurfacingCues: {
        snippets: ["Since last seen", "Why this is back now"],
      },
      progressTrace: { snippets: ["Progress trace"] },
      governanceCues: {
        snippets: ["AgentPolicyCue", "boundaryLabel", "Review posture"],
      },
      internalExecutionCues: { state: "not-in-scope" },
      externalDraftReviewHandoffCues: { state: "not-in-scope" },
      postSendOutcomeCues: { state: "not-in-scope" },
      operationalQueueCardSharedCues: { state: "not-in-scope" },
    },
  },
  {
    surface: "Expansion-review detail",
    role: "third thin adjacent adoption",
    files: [
      "features/expansion-review/detail-model.ts",
      "features/expansion-review/detail-view.tsx",
    ],
    signals: {
      authorityCue: { snippets: ["AgentAuthorityState"] },
      attentionCue: { snippets: ["AgentAttentionState"] },
      resurfacingCues: {
        snippets: ["Since last seen", "Why this is back now"],
      },
      progressTrace: { snippets: ["Progress trace"] },
      governanceCues: {
        snippets: ["AgentPolicyCue", "boundaryLabel", "Commercial review posture"],
      },
      internalExecutionCues: { state: "not-in-scope" },
      externalDraftReviewHandoffCues: { state: "not-in-scope" },
      postSendOutcomeCues: { state: "not-in-scope" },
      operationalQueueCardSharedCues: { state: "not-in-scope" },
    },
  },
  {
    surface: "Customer success queue/cards",
    role: "first operational proving ground",
    files: [
      "app/(workspace)/customer-success/page.tsx",
      "features/customer-success-handoff/queue-model.ts",
      "features/customer-success-handoff/queue-view.tsx",
      "components/shared/agent-queue-card.tsx",
    ],
    signals: {
      authorityCue: { snippets: ["authorityState", "authorityLabel"] },
      attentionCue: { snippets: ["attentionState", "attentionLabel"] },
      resurfacingCues: {
        snippets: ["Since last seen", "Why this is back now"],
      },
      progressTrace: { snippets: ["Progress trace"] },
      governanceCues: {
        snippets: ["Draft policy", "decisionPostureLabel", "readinessLabel"],
      },
      internalExecutionCues: {
        snippets: ["internalActionStatusLabel", "internalActionResultLabel"],
      },
      externalDraftReviewHandoffCues: {
        snippets: ["Prepared external draft", "Review outcome", "Send handoff"],
      },
      postSendOutcomeCues: {
        snippets: ["What happened after send handoff", "data-customer-success-post-send-outcome"],
      },
      operationalQueueCardSharedCues: {
        snippets: [
          "AgentQueueCardView",
          "AgentQueueCardHeader",
          "AgentQueueCardStatusChips",
          "AgentQueueCardResurfaceSummary",
          "AgentQueueCardProgressSummary",
        ],
      },
    },
  },
];

const coreSignalKeys: SignalKey[] = [
  "authorityCue",
  "attentionCue",
  "resurfacingCues",
  "progressTrace",
  "governanceCues",
];

const snapshots: SurfaceSnapshot[] = surfaces.map((surface) => {
  const haystack = surface.files.map(read).join("\n");
  const resolvedSignals = Object.fromEntries(
    Object.entries(surface.signals).map(([key, spec]) => [
      key,
      resolveSignalState(haystack, spec),
    ]),
  ) as Record<SignalKey, SignalState>;

  const coreReady = coreSignalKeys.every(
    (key) => resolvedSignals[key] === "available",
  );
  const operationalReady =
    surface.role !== "first operational proving ground" ||
    resolvedSignals.operationalQueueCardSharedCues === "available";

  return {
    surface: surface.surface,
    role: surface.role,
    manualPilotEvaluation:
      coreReady && operationalReady
        ? "cue-complete-runtime-smoke-required"
        : "not-ready-yet",
    signals: resolvedSignals,
  };
});

const measurableGaps = [
  "actual user time saved",
  "actual collaborator response lift",
  "exact click-through on prepared actions",
  "exact review completion or revision rates across pilots",
  "exact read/open rates on shared agent surfaces",
  "exact external reply or send conversion rates beyond the currently visible manual handoff / manual send record cues",
];

function countCoverage(key: SignalKey) {
  const applicable = snapshots.filter(
    (surface) => surface.signals[key] !== "not-in-scope",
  );
  const available = applicable.filter(
    (surface) => surface.signals[key] === "available",
  );
  return `${available.length} / ${applicable.length}`;
}

console.log("# Shared Agent Outcome Snapshot v1");
console.log("");
console.log(
  "Read-only snapshot from existing code and contract signals only. This does not infer telemetry, user time saved, or business impact.",
);
console.log(
  "It also does not prove runtime route health; pair this snapshot with the latest route smoke or e2e result before calling any surface pilot-ready.",
);
console.log("");

console.log("## Coverage summary");
console.log(`- authority cue presence: ${countCoverage("authorityCue")}`);
console.log(`- attention cue presence: ${countCoverage("attentionCue")}`);
console.log(
  `- since last seen / resurfaced because coverage: ${countCoverage("resurfacingCues")}`,
);
console.log(`- progress trace availability: ${countCoverage("progressTrace")}`);
console.log(
  `- governance / review posture coverage: ${countCoverage("governanceCues")}`,
);
console.log(
  `- internal execution cue coverage: ${countCoverage("internalExecutionCues")}`,
);
console.log(
  `- external draft / review / handoff cue coverage: ${countCoverage("externalDraftReviewHandoffCues")}`,
);
console.log(
  `- post-send outcome cue coverage: ${countCoverage("postSendOutcomeCues")}`,
);
console.log(
  `- operational queue/card shared cue coverage: ${countCoverage("operationalQueueCardSharedCues")}`,
);
console.log("");

console.log("## Surface snapshot");
for (const surface of snapshots) {
  console.log(`### ${surface.surface}`);
  console.log(`- role: ${surface.role}`);
  console.log(
    `- manual pilot evaluation: ${
      surface.manualPilotEvaluation === "cue-complete-runtime-smoke-required"
        ? "cue-complete, runtime smoke still required"
        : "not ready yet"
    }`,
  );

  (Object.keys(surface.signals) as SignalKey[]).forEach((key) => {
    console.log(`- ${formatSignalLabel(key)}: ${formatState(surface.signals[key])}`);
  });

  console.log("");
}

console.log("## Not yet measurable without new instrumentation");
for (const gap of measurableGaps) {
  console.log(`- ${gap}`);
}
