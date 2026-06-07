import { describe, expect, it } from "vitest";

import {
  RUNTIME_PERMISSION_PROFILES,
  resolveRuntimePermissionForCapability,
  resolveSkillRevisionPermission,
  runtimePermissionProfileSchema,
  skillRevisionCandidateSchema,
} from "@/lib/llm/runtime-permission";

describe("runtime permission fencing", () => {
  it("closes the permission enum to the four boundary profiles", () => {
    expect([...RUNTIME_PERMISSION_PROFILES]).toEqual([
      "read_only",
      "draft_only",
      "review_required",
      "blocked_side_effect",
    ]);
    expect(() => runtimePermissionProfileSchema.parse("auto_execute")).toThrow();
  });

  it("blocks every side-effect capability request", () => {
    const sideEffects = [
      "external_send",
      "connector_activation",
      "run_crm_import",
      "approval_task_create",
      "memory_promotion_write",
      "preference_signal_write",
      "pattern_fact_write",
      "recommendation_feedback_write",
      "commitment_upgrade",
      "writeback_to_crm",
    ];
    for (const ref of sideEffects) {
      expect(resolveRuntimePermissionForCapability(ref)).toBe("blocked_side_effect");
    }
  });

  it("grants read/draft/review intents conservatively", () => {
    expect(resolveRuntimePermissionForCapability("read_context")).toBe("read_only");
    expect(resolveRuntimePermissionForCapability("draft_candidate")).toBe("draft_only");
    expect(resolveRuntimePermissionForCapability("boundary_review")).toBe("review_required");
  });

  it("fails closed for unknown / empty capability references", () => {
    expect(resolveRuntimePermissionForCapability("")).toBe("blocked_side_effect");
    expect(resolveRuntimePermissionForCapability("do_something_unspecified")).toBe(
      "blocked_side_effect",
    );
  });

  it("does not let review/draft/read-prefixed side-effect names slip through (allow-list, not substring)", () => {
    expect(resolveRuntimePermissionForCapability("review_and_post_customer_update")).toBe(
      "blocked_side_effect",
    );
    expect(resolveRuntimePermissionForCapability("review_delete_customer_record")).toBe(
      "blocked_side_effect",
    );
    expect(resolveRuntimePermissionForCapability("draft_write_customer_note")).toBe(
      "blocked_side_effect",
    );
    expect(resolveRuntimePermissionForCapability("read_then_send_email")).toBe(
      "blocked_side_effect",
    );
  });

  it("forces a side-effect skill revision candidate to blocked_side_effect", () => {
    const candidate = skillRevisionCandidateSchema.parse({
      revisionId: "rev_1",
      skillKey: "skill_demo",
      capabilityRequested: { capabilityRef: "connector_activation" },
      rationale: ["synthetic"],
    });
    expect(resolveSkillRevisionPermission(candidate)).toBe("blocked_side_effect");
  });

  it("allows a read-only skill revision candidate to stay read_only", () => {
    const candidate = skillRevisionCandidateSchema.parse({
      revisionId: "rev_2",
      skillKey: "skill_demo",
      capabilityRequested: { capabilityRef: "read_evidence" },
    });
    expect(resolveSkillRevisionPermission(candidate)).toBe("read_only");
  });
});
