import { DEFAULT_OPERATION_MODE } from "../worker-modes";

export const CASE_ALLOCATION_DRIVER_MANIFEST = {
  workerId: "case-allocation-driver-v0",
  version: "0.1.0",
  operationMode: DEFAULT_OPERATION_MODE,
  evolutionMode: "rule_based_only",
  maxEffectMode: "read_only",
  abilities: [
    {
      abilityId: "propose_assignment_recommendation",
      requiresApproval: true,
      commitmentLevel: "suggestion_only",
    },
    {
      abilityId: "flag_boundary_review_required",
      requiresApproval: false,
      commitmentLevel: "suggestion_only",
    },
    {
      abilityId: "flag_capacity_gap",
      requiresApproval: false,
      commitmentLevel: "suggestion_only",
    },
  ],
  forbiddenActions: [
    "write business tables",
    "call external connector APIs",
    "auto-send customer-facing messages",
    "promote suggestion_only to commitment",
  ],
  dataAccess: {
    reads: [
      "SampleCaseRecord fixture rows",
      "SampleEmployeeRecord fixture rows",
    ],
    writes: [] as const,
  },
} as const;
