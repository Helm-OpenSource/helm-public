import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE,
  INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION,
  INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  buildInternalDogfoodReviewNotesInputFromJson,
  buildInternalDogfoodReviewNotesPacket,
  type InternalDogfoodReviewNote,
  type InternalDogfoodReviewNotesInput,
} from "./internal-dogfood-review-notes";

function build(patch: Partial<InternalDogfoodReviewNotesInput> = {}) {
  return buildInternalDogfoodReviewNotesPacket({
    ...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
    ...patch,
  });
}

function positiveNotes(): InternalDogfoodReviewNote[] {
  return [...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.notes];
}

describe("internal dogfood review notes constants", () => {
  it("keeps review notes manual-only and runtime adoption no-go", () => {
    expect(INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION).toBe(
      "business-advancement-internal-dogfood-review-notes/v1",
    );
    expect(INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE).toBe("Manual-Review-Notes-Only");
    expect(INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION).toBe("No-Go");
  });
});

describe("buildInternalDogfoodReviewNotesPacket", () => {
  it("defaults to blocked without a ready source packet and review notes", () => {
    const packet = buildInternalDogfoodReviewNotesPacket(
      DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
    );

    expect(packet.decision).toBe("Blocked");
    expect(packet.founderRecommendation).toBe("Blocked");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.blockers.join("\n")).toContain("reviewId");
    expect(packet.blockers.join("\n")).toContain("source packet");
    expect(packet.blockers.join("\n")).toContain("engineering");
  });

  it("builds founder-review-ready notes from complete positive evidence", () => {
    const packet = buildInternalDogfoodReviewNotesPacket(
      POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
    );

    expect(packet.decision).toBe("Ready-For-Founder-Review");
    expect(packet.founderRecommendation).toBe(
      "Continue-Disabled-Internal-Dogfooding",
    );
    expect(packet.runtimeAdoption).toBe("No-Go");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.metrics).toMatchObject({
      totalNotes: 5,
      acceptCount: 5,
      falsePositiveCount: 0,
      missingEvidenceCount: 0,
      thresholdConcernCount: 0,
      stopCount: 0,
    });
    expect(packet.lensCoverage.every((item) => item.covered)).toBe(true);
    expect(packet.familyCoverage.every((item) => item.covered)).toBe(true);
    expect(packet.blockers).toEqual([]);
  });

  it("keeps issue notes ready for founder review but recommends revision", () => {
    const notes = positiveNotes();
    notes[0] = {
      ...notes[0],
      verdict: "false_positive",
      notes: "One blocked-decision row appears noisy in internal review.",
      recommendedNextStep: "revise_packet",
    };

    const packet = build({ notes });

    expect(packet.decision).toBe("Ready-For-Founder-Review");
    expect(packet.founderRecommendation).toBe(
      "Revise-Before-Next-Internal-Dogfood",
    );
    expect(packet.metrics.falsePositiveCount).toBe(1);
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
  });

  it("blocks when any reviewer requests stop", () => {
    const notes = positiveNotes();
    notes[1] = {
      ...notes[1],
      verdict: "stop",
      notes: "Stop until calibration is rerun.",
      recommendedNextStep: "return_to_calibration",
    };

    const packet = build({ notes });

    expect(packet.decision).toBe("Blocked");
    expect(packet.founderRecommendation).toBe("Stop-And-Return-To-Calibration");
    expect(packet.blockers.join("\n")).toContain("stop recommendation");
  });

  it("blocks when a required review lens is missing", () => {
    const notes = positiveNotes().filter(
      (note) => note.reviewerLens !== "data_protection",
    );

    const packet = build({ notes });

    expect(packet.decision).toBe("Blocked");
    expect(packet.lensCoverage.find((item) => item.lens === "data_protection")).toMatchObject({
      covered: false,
      noteCount: 0,
    });
    expect(packet.blockers.join("\n")).toContain("data_protection");
  });

  it("blocks when an included candidate family lacks review notes", () => {
    const notes = positiveNotes().filter((note) => note.familyId !== "TPQR-003");

    const packet = build({ notes });

    expect(packet.decision).toBe("Blocked");
    expect(packet.familyCoverage.find((item) => item.familyId === "TPQR-003")).toMatchObject({
      covered: false,
      noteCount: 0,
    });
    expect(packet.blockers.join("\n")).toContain("Every candidate group");
  });

  it("blocks invalid note structure", () => {
    const notes = positiveNotes();
    notes[2] = {
      ...notes[2],
      reviewedAtIso: "2026/04/30",
      evidenceRefs: [],
    };

    const packet = build({ notes });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Review notes must include");
  });

  it("blocks incompatible verdict and next-step pairs", () => {
    const notes = positiveNotes();
    notes[3] = {
      ...notes[3],
      verdict: "accept_for_internal_dogfood",
      recommendedNextStep: "revise_packet",
    };

    const packet = build({ notes });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("allowed next step");
  });

  it("blocks if the source dogfood packet is not ready", () => {
    const packet = build({
      packet: DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.packet,
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Ready-For-Internal-Dogfooding");
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/internal-dogfood-review-notes.ts",
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

describe("buildInternalDogfoodReviewNotesInputFromJson", () => {
  it("builds a ready review packet from the sample JSON input", () => {
    const raw = readFileSync(
      "features/business-advancement/internal-dogfood-review-notes.sample.json",
      "utf8",
    );
    const input = buildInternalDogfoodReviewNotesInputFromJson(JSON.parse(raw));
    const packet = buildInternalDogfoodReviewNotesPacket(input);

    expect(packet.decision).toBe("Ready-For-Founder-Review");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.metrics.totalNotes).toBe(5);
  });

  it("rejects JSON inputs that try to carry authority or source packet state", () => {
    const raw = {
      reviewContext: POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.reviewContext,
      notes: POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.notes,
      productionQueryAdoptionAllowed: true,
    };

    expect(() => buildInternalDogfoodReviewNotesInputFromJson(raw)).toThrow(
      "authority key",
    );
  });

  it("rejects JSON notes with unsupported family, lens or verdict values", () => {
    const raw = {
      reviewContext: POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.reviewContext,
      notes: [
        {
          ...POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT.notes[0],
          familyId: "TPQR-999",
        },
      ],
    };

    expect(() => buildInternalDogfoodReviewNotesInputFromJson(raw)).toThrow(
      "invalid note",
    );
  });
});
