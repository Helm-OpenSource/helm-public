import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  SALES_PROCESS_SIGNAL_CONTRACT_VERSION,
  SALES_PROCESS_SIGNAL_TYPES,
  SALES_PROCESS_STATEMENT_MAX_LENGTH,
  auditSalesProcessSignalHygiene,
  type SalesProcessSignal,
} from "./contract";
import {
  mapConversationInsightToSalesProcessSignal,
  mapMeetingMemoryDraftToSalesProcessSignal,
  type ConversationInsightLike,
  type MeetingMemoryDraftLike,
} from "./mappers";

const CONTEXT = {
  aliases: {
    seller: "seller_alias_01",
    buyer: "buyer_alias_01",
    workspace: "workspace_alias_internal",
  },
} as const;

const INSIGHT: ConversationInsightLike = {
  id: "ins-001",
  insightType: "COMMITMENT",
  title: "买方同意本周内评估试用方案",
  confidence: 82,
  sourceSegmentRefs: JSON.stringify(["segment:12", "segment:13"]),
};

const DRAFT: MeetingMemoryDraftLike = {
  draftId: "draft-001",
  factType: "OBJECTION",
  title: "对按门店计价方式有异议",
  confidence: 74,
  meetingRef: "meeting:m-100",
};

describe("sales process signal contract", () => {
  it("pins the contract version and the closed type set", () => {
    expect(SALES_PROCESS_SIGNAL_CONTRACT_VERSION).toBe(
      "sales-process-signal/v1",
    );
    expect(SALES_PROCESS_SIGNAL_TYPES).toEqual([
      "commitment",
      "objection",
      "need_candidate",
      "risk_signal",
      "deal_outcome_reason",
      "follow_up_window",
    ]);
    expect(SALES_PROCESS_STATEMENT_MAX_LENGTH).toBe(280);
  });
});

describe("mapConversationInsightToSalesProcessSignal", () => {
  it("maps a commitment insight into a review-required alias-only signal", () => {
    const result = mapConversationInsightToSalesProcessSignal(INSIGHT, CONTEXT);

    expect(result.skippedReason).toBeUndefined();
    const signal = result.signal as SalesProcessSignal;
    expect(signal.signalType).toBe("commitment");
    expect(signal.statement).toBe("买方同意本周内评估试用方案");
    expect(signal.sourceRef).toBe("conversation_insight:ins-001");
    expect(signal.evidenceRefs).toEqual(["segment:12", "segment:13"]);
    expect(signal.reviewPosture).toBe("review_required");
    expect(signal.dataShape).toBe("alias_only");
    expect(signal.rawPayloadIncluded).toBe(false);
    expect(signal.transcriptIncluded).toBe(false);
    expect(signal.audioIncluded).toBe(false);
  });

  it("maps BLOCKER and RISK to risk_signal and NEXT_ACTION to follow_up_window", () => {
    for (const [insightType, expected] of [
      ["BLOCKER", "risk_signal"],
      ["RISK", "risk_signal"],
      ["NEXT_ACTION", "follow_up_window"],
    ] as const) {
      const result = mapConversationInsightToSalesProcessSignal(
        { ...INSIGHT, insightType },
        CONTEXT,
      );
      expect(result.signal?.signalType).toBe(expected);
    }
  });

  it("skips FACT honestly instead of force-classifying it", () => {
    const result = mapConversationInsightToSalesProcessSignal(
      { ...INSIGHT, insightType: "FACT" },
      CONTEXT,
    );
    expect(result.signal).toBeNull();
    expect(result.skippedReason).toBe("insight_type_not_classifiable");
  });

  it("treats non-JSON segment refs as a single opaque reference", () => {
    const result = mapConversationInsightToSalesProcessSignal(
      { ...INSIGHT, sourceSegmentRefs: "opaque-ref-7" },
      CONTEXT,
    );
    expect(result.signal?.evidenceRefs).toEqual(["opaque-ref-7"]);
  });
});

describe("mapMeetingMemoryDraftToSalesProcessSignal", () => {
  it("maps an objection draft with the meeting evidence ref", () => {
    const result = mapMeetingMemoryDraftToSalesProcessSignal(DRAFT, CONTEXT);
    expect(result.signal?.signalType).toBe("objection");
    expect(result.signal?.evidenceRefs).toEqual(["meeting:m-100"]);
    expect(result.signal?.sourceKind).toBe("meeting_memory_draft");
  });

  it("skips RELATIONSHIP / PREFERENCE / SUMMARY / pattern types honestly", () => {
    for (const factType of [
      "RELATIONSHIP",
      "PREFERENCE",
      "SUMMARY",
      "POLICY_PATTERN",
      "ACTION_PATTERN",
    ] as const) {
      const result = mapMeetingMemoryDraftToSalesProcessSignal(
        { ...DRAFT, factType },
        CONTEXT,
      );
      expect(result.signal).toBeNull();
      expect(result.skippedReason).toBe("fact_type_not_classifiable");
    }
  });

  it("maps STAGE_SIGNAL to deal_outcome_reason and NEXT_STEP to follow_up_window", () => {
    expect(
      mapMeetingMemoryDraftToSalesProcessSignal(
        { ...DRAFT, factType: "STAGE_SIGNAL" },
        CONTEXT,
      ).signal?.signalType,
    ).toBe("deal_outcome_reason");
    expect(
      mapMeetingMemoryDraftToSalesProcessSignal(
        { ...DRAFT, factType: "NEXT_STEP" },
        CONTEXT,
      ).signal?.signalType,
    ).toBe("follow_up_window");
  });
});

describe("hygiene fail-closed", () => {
  it("suppresses signals whose statement smells like verbatim transcript", () => {
    const result = mapConversationInsightToSalesProcessSignal(
      { ...INSIGHT, title: "x".repeat(SALES_PROCESS_STATEMENT_MAX_LENGTH + 1) },
      CONTEXT,
    );
    expect(result.signal).toBeNull();
    expect(result.skippedReason).toBe("hygiene_violation");
    expect(result.hygieneViolations).toContain(
      "statement_too_long_smells_verbatim",
    );
  });

  it("suppresses statements containing emails, phone numbers, or URLs", () => {
    for (const [title, violation] of [
      ["联系 someone@example.com 跟进", "statement_contains_email"],
      ["回电 138 0013 8000 确认", "statement_contains_phone_number"],
      ["详见 https://example.com/deal", "statement_contains_url"],
    ] as const) {
      const result = mapConversationInsightToSalesProcessSignal(
        { ...INSIGHT, title },
        CONTEXT,
      );
      expect(result.signal).toBeNull();
      expect(result.hygieneViolations).toContain(violation);
    }
  });

  it("flags empty statements, missing workspace alias, and bad confidence", () => {
    const base = mapConversationInsightToSalesProcessSignal(INSIGHT, CONTEXT)
      .signal as SalesProcessSignal;

    expect(
      auditSalesProcessSignalHygiene({ ...base, statement: "  " }),
    ).toContain("statement_empty");
    expect(
      auditSalesProcessSignalHygiene({
        ...base,
        aliases: { ...base.aliases, workspace: "" },
      }),
    ).toContain("workspace_alias_missing");
    expect(
      auditSalesProcessSignalHygiene({ ...base, confidence: 101 }),
    ).toContain("confidence_out_of_range");
  });
});

describe("import hygiene", () => {
  it("does not import prisma, db, app, fs, or network modules", () => {
    for (const file of [
      "lib/sales-process-signal/contract.ts",
      "lib/sales-process-signal/mappers.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      const importLines = source
        .split("\n")
        .filter((line) => line.trim().startsWith("import "));
      expect(importLines.join("\n")).not.toContain("@/");
      expect(importLines.join("\n")).not.toContain("prisma");
      expect(importLines.join("\n")).not.toContain("data/queries");
      expect(importLines.join("\n")).not.toContain('from "fs"');
      expect(source).not.toContain("fetch(");
    }
  });
});
