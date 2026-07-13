import { describe, expect, it } from "vitest";

import {
  buildCoreDefaultOperationSuggestions,
  validateOperationSuggestions,
  type AgentReadyChangePacket,
  type OperationSuggestion,
} from "./operation-suggestion";

function changePacket(
  overrides: Partial<AgentReadyChangePacket> = {},
): AgentReadyChangePacket {
  return {
    goal: "Declare the workspace focus areas",
    currentState: "No focus areas are configured",
    prerequisites: [],
    requiredPermissions: ["workspace.settings.write"],
    proposedChanges: ["Set focusAreas through the existing settings owner"],
    effectLevel: "configuration_change",
    forbiddenActions: ["Do not change connector authorization or send external messages"],
    dryRun: {
      required: true,
      procedure: "Preview the settings diff without saving",
      expectedResult: "The diff only changes focusAreas",
    },
    approvalPolicy: {
      required: true,
      approverRole: "workspace_owner",
      checkpoints: ["Review the generated settings diff"],
      separationOfDutiesRequired: false,
    },
    rollback: {
      strategy: "restore_previous_state",
      procedure: "Restore the previous focusAreas value",
      verification: "Re-read the workspace settings",
    },
    expectedReceipts: ["plan", "dry_run", "change_diff", "verification"],
    ...overrides,
  };
}

function suggestion(overrides: Partial<OperationSuggestion> = {}): OperationSuggestion {
  return {
    key: "init-focus-areas",
    category: "initialization",
    title: "设置工作区关注领域",
    rationale: "冷启动需先声明关注领域,信号才能对齐",
    readiness: "ready",
    preconditionRefs: [],
    changePacket: changePacket(),
    verificationRef: "/settings",
    href: "/settings",
    basisRef: "core:init-focus-areas",
    ...overrides,
  };
}

const has = (items: OperationSuggestion[], issue: string) =>
  validateOperationSuggestions(items).some((i) => i.issue === issue);

describe("validateOperationSuggestions", () => {
  it("passes a well-formed, de-identified suggestion", () => {
    expect(validateOperationSuggestions([suggestion()])).toEqual([]);
  });

  it("allows an explicit read-only packet without elevated permission or approval", () => {
    expect(
      validateOperationSuggestions([
        suggestion({
          changePacket: changePacket({
            effectLevel: "read_only",
            requiredPermissions: [],
            dryRun: {
              required: false,
              procedure: "Inspect the current settings without mutation",
              expectedResult: "No workspace state changes",
            },
            approvalPolicy: {
              required: false,
              approverRole: null,
              checkpoints: [],
              separationOfDutiesRequired: false,
            },
            rollback: {
              strategy: "not_applicable",
              procedure: "No rollback because no state changes",
              verification: "Confirm the workspace update timestamp is unchanged",
            },
          }),
        }),
      ]),
    ).toEqual([]);
  });

  it("passes a blocked suggestion carrying precondition refs", () => {
    expect(
      validateOperationSuggestions([
        suggestion({
          readiness: "blocked_precondition",
          preconditionRefs: ["ref:needs-connector"],
          changePacket: changePacket({ prerequisites: ["Read-only connector proof is missing"] }),
        }),
      ]),
    ).toEqual([]);
  });

  it("rejects a callback field (suggestion ≠ execution; no callbacks)", () => {
    expect(has([{ ...suggestion(), onRun: () => {} } as never], "callback_field:onRun")).toBe(true);
  });

  it("rejects unknown top-level fields", () => {
    expect(
      has(
        [{ ...suggestion(), implementationNote: "not part of the contract" } as never],
        "unknown_suggestion_field:implementationNote",
      ),
    ).toBe(true);
  });

  it("rejects unknown category / readiness enums", () => {
    expect(has([suggestion({ category: "misc" as never })], "unknown_category")).toBe(true);
    expect(has([suggestion({ readiness: "running" as never })], "unknown_readiness")).toBe(true);
  });

  it("rejects unknown effect and rollback enums without throwing", () => {
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({ effectLevel: "execute" as never }),
          }),
        ],
        "unknown_change_packet_effect_level",
      ),
    ).toBe(true);
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              rollback: { strategy: "instant" } as never,
            }),
          }),
        ],
        "invalid_change_packet_field:rollback.strategy",
      ),
    ).toBe(true);
  });

  it("bounds packet text and list sizes", () => {
    expect(
      has(
        [suggestion({ changePacket: changePacket({ goal: "x".repeat(2_001) }) })],
        "invalid_change_packet_field:goal",
      ),
    ).toBe(true);
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              expectedReceipts: Array.from({ length: 51 }, (_, index) => `receipt-${index}`),
            }),
          }),
        ],
        "invalid_change_packet_field:expectedReceipts",
      ),
    ).toBe(true);
  });

  it("rejects the legacy agentBrief-only shape", () => {
    const legacy = { ...suggestion(), changePacket: undefined, agentBrief: "Update focusAreas" };
    expect(has([legacy as never], "missing_change_packet")).toBe(true);
    expect(has([legacy as never], "legacy_agent_brief_not_allowed")).toBe(true);
  });

  it.each([
    "goal",
    "currentState",
    "prerequisites",
    "requiredPermissions",
    "proposedChanges",
    "effectLevel",
    "forbiddenActions",
    "dryRun",
    "approvalPolicy",
    "rollback",
    "expectedReceipts",
  ] as const)("rejects a change packet missing %s", (field) => {
    const packet = { ...changePacket() } as Record<string, unknown>;
    delete packet[field];
    expect(
      has(
        [suggestion({ changePacket: packet as AgentReadyChangePacket })],
        `missing_change_packet_field:${field}`,
      ),
    ).toBe(true);
  });

  it("rejects callbacks anywhere in the nested packet", () => {
    const packet = changePacket({
      dryRun: {
        ...changePacket().dryRun,
        onRun: () => {},
      } as never,
    });
    expect(
      has(
        [suggestion({ changePacket: packet })],
        "callback_field:change_packet.dryRun.onRun",
      ),
    ).toBe(true);
  });

  it("fails closed on suspected secrets in change-packet string leaves", () => {
    // Secret-SHAPED strings are built at runtime (interpolation breaks the source
    // literal) so this public-shipped test carries no scannable secret while still
    // exercising the fail-closed validator.
    const skKey = `sk-${"ABCDEF0123456789abcdef"}`;
    const awsKey = `AKIA${"0123456789ABCDEF"}`;
    const ghToken = `gho_${"abcdefghijklmnopqrstuvwxyz0123"}`;
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({ proposedChanges: [`export ${"TOKEN"}=${skKey}`] }),
          }),
        ],
        "change_packet.proposedChanges[0]_looks_like_secret",
      ),
    ).toBe(true);
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              dryRun: {
                ...changePacket().dryRun,
                procedure: `use ${awsKey} for S3`,
              },
            }),
          }),
        ],
        "change_packet.dryRun.procedure_looks_like_secret",
      ),
    ).toBe(true);
    expect(has([suggestion({ rationale: `${"password"}: hunter2 required` })], "rationale_looks_like_secret")).toBe(true);
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({ forbiddenActions: [`paste ${ghToken}`] }),
          }),
        ],
        "change_packet.forbiddenActions[0]_looks_like_secret",
      ),
    ).toBe(true);
  });

  it("fails closed on suspected PII in top-level and packet fields", () => {
    expect(has([suggestion({ title: "联系 13800138000 开通" })], "title_looks_like_pii")).toBe(true);
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              approvalPolicy: {
                ...changePacket().approvalPolicy,
                approverRole: "admin@example.com",
              },
            }),
          }),
        ],
        "change_packet.approvalPolicy.approverRole_looks_like_pii",
      ),
    ).toBe(true);
  });

  it("requires dry-run for configuration changes and human approval for external side effects", () => {
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              dryRun: { ...changePacket().dryRun, required: false },
            }),
          }),
        ],
        "configuration_change_without_required_dry_run",
      ),
    ).toBe(true);
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              effectLevel: "external_side_effect",
              approvalPolicy: {
                required: false,
                approverRole: null,
                checkpoints: [],
                separationOfDutiesRequired: false,
              },
            }),
          }),
        ],
        "external_side_effect_without_approval",
      ),
    ).toBe(true);
  });

  it("requires complete approval, rollback and evidence instructions", () => {
    expect(
      has(
        [
          suggestion({
            changePacket: changePacket({
              approvalPolicy: {
                required: true,
                approverRole: null,
                checkpoints: [],
                separationOfDutiesRequired: false,
              },
            }),
          }),
        ],
        "approval_without_approver_role",
      ),
    ).toBe(true);
    expect(
      has(
        [suggestion({ changePacket: changePacket({ forbiddenActions: [] }) })],
        "empty_change_packet_field:forbiddenActions",
      ),
    ).toBe(true);
    expect(
      has(
        [suggestion({ changePacket: changePacket({ expectedReceipts: [] }) })],
        "empty_change_packet_field:expectedReceipts",
      ),
    ).toBe(true);
  });

  it("rejects blocked readiness with no precondition refs", () => {
    expect(
      has([suggestion({ readiness: "blocked_precondition", preconditionRefs: [] })], "blocked_without_precondition_refs"),
    ).toBe(true);
    expect(
      has(
        [
          suggestion({
            readiness: "blocked_precondition",
            preconditionRefs: ["ref:needs-connector"],
          }),
        ],
        "blocked_without_packet_prerequisites",
      ),
    ).toBe(true);
  });

  it("rejects pending_source without a note, and empty precondition refs", () => {
    expect(has([suggestion({ readiness: "pending_source" })], "pending_source_without_note")).toBe(true);
    expect(has([suggestion({ preconditionRefs: [" "] })], "empty_precondition_ref")).toBe(true);
  });

  it("rejects empty required strings, off-site href, dup key", () => {
    expect(has([suggestion({ key: "" })], "empty_key")).toBe(true);
    expect(has([suggestion({ title: "" })], "empty_title")).toBe(true);
    expect(has([suggestion({ rationale: " " })], "empty_rationale")).toBe(true);
    expect(
      has(
        [suggestion({ changePacket: changePacket({ goal: "" }) })],
        "empty_change_packet_field:goal",
      ),
    ).toBe(true);
    expect(has([suggestion({ verificationRef: "" })], "empty_verification_ref")).toBe(true);
    expect(has([suggestion({ basisRef: "" })], "empty_basis_ref")).toBe(true);
    expect(has([suggestion({ href: "https://evil.example" })], "href_not_in_site")).toBe(true);
    expect(has([suggestion({ key: "d" }), suggestion({ key: "d" })], "duplicate_key")).toBe(true);
  });

  it("allows a null href (suggestion with no detail page)", () => {
    expect(validateOperationSuggestions([suggestion({ href: null })])).toEqual([]);
  });
});

describe("buildCoreDefaultOperationSuggestions", () => {
  it("is an honest empty set (Core has no infrequent-op source; no fabrication)", () => {
    expect(buildCoreDefaultOperationSuggestions()).toEqual([]);
  });
});
