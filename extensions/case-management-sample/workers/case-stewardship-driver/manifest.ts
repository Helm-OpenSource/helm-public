import { DEFAULT_OPERATION_MODE } from "../worker-modes";

export const CASE_STEWARDSHIP_DRIVER_MANIFEST = {
  workerId: "case-stewardship-driver-v0",
  version: "0.1.0",
  operationMode: DEFAULT_OPERATION_MODE,
  evolutionMode: "rule_based_only",
  maxEffectMode: "read_only",
  abilities: [
    {
      abilityId: "stewardship_roster_emit",
      requiresApproval: false,
      commitmentLevel: "suggestion_only",
    },
    {
      abilityId: "flag_evidence_gap",
      requiresApproval: false,
      commitmentLevel: "suggestion_only",
    },
    {
      abilityId: "flag_idle_case",
      requiresApproval: false,
      commitmentLevel: "suggestion_only",
    },
    {
      abilityId: "flag_dropped_case",
      requiresApproval: false,
      commitmentLevel: "suggestion_only",
    },
  ],
  forbiddenActions: [
    "write business tables",
    "assign or reassign cases",
    "close cases",
    "send outbound messages",
  ],
  dataAccess: {
    reads: ["SampleCaseRecord fixture rows"],
    writes: [] as const,
  },
} as const;
