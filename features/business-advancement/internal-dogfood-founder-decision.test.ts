import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
  evaluateInternalDogfoodFounderDecision,
  type InternalDogfoodFounderDecisionInput,
} from "./internal-dogfood-founder-decision";
import {
  POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  buildInternalDogfoodReviewNotesPacket,
} from "./internal-dogfood-review-notes";

function build(patch: Partial<InternalDogfoodFounderDecisionInput> = {}) {
  return evaluateInternalDogfoodFounderDecision({
    ...POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
    ...patch,
  });
}

describe("internal dogfood founder decision constants", () => {
  it("keeps the founder decision gate disabled-internal-only and runtime no-go", () => {
    expect(INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION).toBe(
      "business-advancement-internal-dogfood-founder-decision/v1",
    );
    expect(INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE).toBe(
      "Founder-Decision-For-Disabled-Internal-Dogfood",
    );
    expect(INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION).toBe("No-Go");
  });
});

describe("evaluateInternalDogfoodFounderDecision", () => {
  it("defaults to blocked without ready review notes or founder approval", () => {
    const packet = evaluateInternalDogfoodFounderDecision(
      DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
    );

    expect(packet.decision).toBe("Blocked");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.blockers.join("\n")).toContain("Founder decision");
    expect(packet.blockers.join("\n")).toContain("Ready-For-Founder-Review");
  });

  it("approves only the next disabled internal dogfood iteration from positive evidence", () => {
    const packet = evaluateInternalDogfoodFounderDecision(
      POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
    );

    expect(packet.decision).toBe(
      "Approve-Next-Disabled-Internal-Dogfood-Iteration",
    );
    expect(packet.runtimeAdoption).toBe("No-Go");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.allowedNextStep).toContain("disabled internal dogfood");
    expect(packet.allowedNextStep).toContain("production query adoption");
    expect(packet.blockers).toEqual([]);
  });

  it("routes issue-note recommendations to revise before the next iteration", () => {
    const notes = [...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.notes];
    notes[0] = {
      ...notes[0],
      verdict: "false_positive",
      notes: "One row appears noisy.",
      recommendedNextStep: "revise_packet",
    };
    const reviewNotesPacket = buildInternalDogfoodReviewNotesPacket({
      ...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
      notes,
    });

    const packet = build({
      founderDecision: {
        ...POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT.founderDecision,
        approvedRecommendation: "Revise-Before-Next-Internal-Dogfood",
      },
      reviewNotesPacket,
    });

    expect(packet.decision).toBe("Revise-Before-Next-Iteration");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
  });

  it("blocks if founder decision does not match the review recommendation", () => {
    const packet = build({
      founderDecision: {
        ...POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT.founderDecision,
        approvedRecommendation: "Revise-Before-Next-Internal-Dogfood",
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("same recommendation");
  });

  it("blocks incomplete founder evidence", () => {
    const packet = build({
      founderDecision: {
        ...POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT.founderDecision,
        approvedAtIso: "April 30 2026",
        evidenceNotes: "",
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("strict UTC timestamp");
  });

  it("blocks if review notes are not ready", () => {
    const packet = build({
      reviewNotesPacket:
        DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT.reviewNotesPacket,
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Ready-For-Founder-Review");
  });

  it("keeps forbidden work explicit", () => {
    const packet = evaluateInternalDogfoodFounderDecision(
      POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
    );

    expect(packet.forbiddenWork.join("\n")).toContain("data/queries.ts");
    expect(packet.forbiddenWork.join("\n")).toContain("production query adoption");
    expect(packet.forbiddenWork.join("\n")).toContain("auto-execute");
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/internal-dogfood-founder-decision.ts",
      "utf8",
    );

    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(importLines.join("\n")).not.toContain("@/");
    expect(importLines.join("\n")).not.toContain("data/queries");
    expect(importLines.join("\n")).not.toContain("features/mobile");
    expect(importLines.join("\n")).not.toContain("app/");
    expect(importLines.join("\n")).not.toContain("prisma");
    expect(importLines.join("\n")).not.toContain("from \"fs\"");
    expect(source).not.toContain("fetch(");
  });
});
