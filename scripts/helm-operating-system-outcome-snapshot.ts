import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type SnapshotState = "present" | "unavailable" | "not measurable yet";

type SnapshotItem = {
  label: string;
  state: SnapshotState;
  detail: string;
};

const root = process.cwd();

function fileExists(relativePath: string) {
  return existsSync(path.join(root, relativePath));
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function includesAll(content: string, snippets: string[]) {
  return snippets.every((snippet) => content.includes(snippet));
}

function byFileAndSnippets(
  label: string,
  relativePath: string,
  snippets: string[],
  detailWhenPresent: string,
): SnapshotItem {
  if (!fileExists(relativePath)) {
    return {
      label,
      state: "unavailable",
      detail: `${relativePath} is missing`,
    };
  }

  const content = read(relativePath);
  if (!includesAll(content, snippets)) {
    return {
      label,
      state: "unavailable",
      detail: `${relativePath} does not expose all expected grounded cues`,
    };
  }

  return {
    label,
    state: "present",
    detail: detailWhenPresent,
  };
}

function byFilesAndSnippets(
  label: string,
  files: string[],
  snippets: string[],
  detailWhenPresent: string,
): SnapshotItem {
  const missingFiles = files.filter((relativePath) => !fileExists(relativePath));
  if (missingFiles.length > 0) {
    return {
      label,
      state: "unavailable",
      detail: `missing files: ${missingFiles.join(", ")}`,
    };
  }

  const haystack = files.map((relativePath) => read(relativePath)).join("\n");
  if (!includesAll(haystack, snippets)) {
    return {
      label,
      state: "not measurable yet",
      detail: "surface exists, but not all grounded cue snippets are visible from current code",
    };
  }

  return {
    label,
    state: "present",
    detail: detailWhenPresent,
  };
}

function formatState(state: SnapshotState) {
  switch (state) {
    case "present":
      return "present";
    case "unavailable":
      return "unavailable";
    case "not measurable yet":
      return "not measurable yet";
  }
}

const coreLayers: SnapshotItem[] = [
  byFileAndSnippets(
    "object-state layer",
    "lib/operating-system/object-state.ts",
    ["buildOperatingObjectState", "buildMemoryObjectStateSnapshots"],
    "Object-state substrate is implemented in the operating-system layer.",
  ),
  byFileAndSnippets(
    "skill catalog",
    "lib/operating-system/skill-catalog.ts",
    ["getOperatingSkillById", "getOperatingSkillsForSurface", "pilot-readiness-diagnostics"],
    "Skill catalog is present and exposes stable surface-oriented skills.",
  ),
  byFileAndSnippets(
    "shared operating-system types",
    "lib/operating-system/types.ts",
    ["OperatingSkill", "OperatingObjectState", "PilotReadinessModel"],
    "Shared operating-system contracts are present.",
  ),
  byFileAndSnippets(
    "event signal layer",
    "lib/operating-system/event-signals.ts",
    ["buildWorkspaceEventSignals", "approval-backlog", "memory-correction-burst"],
    "Event signal layer is present and grounded in current operating signals.",
  ),
  byFileAndSnippets(
    "recommendation-context layer",
    "lib/operating-system/recommendation-context.ts",
    [
      "buildRecommendationOperatingContext",
      "skillLine",
      "eventLine",
      "stateLine",
      "governanceLine",
    ],
    "Recommendation context layer is present.",
  ),
  byFileAndSnippets(
    "approval-boundary layer",
    "lib/operating-system/approval-boundary.ts",
    ["buildApprovalBoundaryModel", "buildApprovalTaskReasonChain"],
    "Approval boundary and reason-chain layer is present.",
  ),
  byFileAndSnippets(
    "audit reason-chain layer",
    "lib/operating-system/audit-reason-chain.ts",
    ["buildAuditReasonChain"],
    "Audit reason-chain layer is present.",
  ),
  byFileAndSnippets(
    "readiness layer",
    "lib/operating-system/readiness.ts",
    ["buildPilotReadinessModel", "stage", "gates"],
    "Pilot readiness layer is present.",
  ),
  byFileAndSnippets(
    "dashboard arbitration layer",
    "lib/operating-system/dashboard-arbitration.ts",
    ["buildDashboardArbitrationModel", "firstMoveSummary", "boundarySummary"],
    "Dashboard arbitration layer is present.",
  ),
];

const surfaces: SnapshotItem[] = [
  byFilesAndSnippets(
    "dashboard OS cues",
    ["app/(workspace)/dashboard/page.tsx"],
    [
      "buildDashboardArbitrationModel",
      "buildWorkspaceEventSignals",
      "buildRecommendationOperatingContext",
      "dashboardArbitration.firstMoveSummary",
      "dashboardArbitration.whyNow",
      "dashboardArbitration.boundarySummary",
    ],
    "Dashboard surface shows arbitration, event-signal, recommendation-context and boundary cues.",
  ),
  byFilesAndSnippets(
    "memory OS cues",
    ["features/memory/memory-client.tsx"],
    [
      "buildMemoryObjectStateSnapshots",
      "buildAuditReasonChain",
      "Object-state substrate",
      "snapshot.suggestedSkillIds.map",
      "Recent audit replay",
    ],
    "Memory surface shows object-state substrate, suggested operating skills and audit replay cues.",
  ),
  byFilesAndSnippets(
    "approvals OS cues",
    ["features/approvals/approvals-client.tsx"],
    [
      "buildApprovalBoundaryModel",
      "buildApprovalTaskReasonChain",
      "审批现在更像 AI 动作边界控制台",
      "boundaryModel.topSkillIds",
      "Reason chain",
    ],
    "Approvals surface shows boundary state, skill cues and approval reason-chain cues.",
  ),
  byFilesAndSnippets(
    "diagnostics OS cues",
    ["features/diagnostics/diagnostics-client.tsx"],
    [
      "buildPilotReadinessModel",
      "试点 readiness 判断",
      "readiness.recommendedSkillIds.map",
      "readiness.gates.map",
      "当前已经在线的标准化能力",
    ],
    "Diagnostics surface shows readiness score, gates and online skill cues.",
  ),
];

const measurementBoundary: SnapshotItem[] = [
  {
    label: "measured business impact",
    state: "not measurable yet",
    detail: "Current snapshot only reports grounded cue / surface coverage from code-visible signals.",
  },
  {
    label: "send authority",
    state: "not measurable yet",
    detail: "This snapshot does not validate external send authority and must not be used to imply it.",
  },
  {
    label: "workflow control",
    state: "not measurable yet",
    detail: "This snapshot does not validate workflow-control semantics or system-of-record behavior.",
  },
];

function printSection(title: string, items: SnapshotItem[]) {
  console.log(`## ${title}`);
  for (const item of items) {
    console.log(`- ${item.label}: ${formatState(item.state)}`);
    console.log(`  ${item.detail}`);
  }
  console.log("");
}

console.log("# Helm Operating System Pilot 001 Outcome Snapshot");
console.log("");
console.log("- scope: read-only cue / surface coverage only");
console.log("- route-owner truth: root app/ remains the route owner");
console.log("- query truth: data/queries.ts remains a compatibility façade / aggregation seam");
console.log("- shell truth: shell thinning has not started");
console.log("");

printSection("Operating-system core coverage", coreLayers);
printSection("Surface cue coverage", surfaces);
printSection("Measurement boundary", measurementBoundary);
