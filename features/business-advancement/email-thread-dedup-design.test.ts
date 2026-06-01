import { describe, expect, it } from "vitest";
import {
  EMAIL_THREAD_DEDUP_EVIDENCE,
  OWNERSHIP_RULE_SELECTION,
  SELECTED_OWNERSHIP_RULE,
  evaluateEmailThreadDedupDesign,
  mergeAndDedupByEmailThreadId,
  type PlanningEmailThreadItem,
} from "./email-thread-dedup-design";

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "authorizes schema design",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "authorizes official write",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may auto-send",
  "may auto send",
  "may auto-approve",
  "may auto approve",
  "llm may determine",
  "llm may rank",
  "may change page behavior",
  "may add api route",
  "approves runtime adoption",
  "approves production query adoption",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

const REQUIRED_REPO_TRUTH_LOCATORS = [
  "features/mobile/lib/mobile-command-read-model.ts:72",
  "features/mobile/lib/mobile-command-read-model.ts:310",
  "features/mobile/lib/mobile-command-read-model.ts:328",
  "features/business-advancement/thin-projection-query-review.ts:254",
  "prisma/schema.prisma:3019",
  "prisma/schema.prisma:3022",
  "prisma/schema.prisma:3037",
  "features/business-advancement/runtime-readiness-preflight.ts:157",
  "features/business-advancement/runtime-guard-resolution-plan.ts:176",
] as const;

describe("EMAIL_THREAD_DEDUP_EVIDENCE", () => {
  it("contains at least one evidence row", () => {
    expect(EMAIL_THREAD_DEDUP_EVIDENCE.length).toBeGreaterThan(0);
  });

  it("every row has a non-empty evidenceId", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(row.evidenceId.trim(), "evidenceId").not.toBe("");
    }
  });

  it("every row has a non-empty filePath", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(row.filePath.trim(), `${row.evidenceId}: filePath`).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceLocator", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(
        row.evidenceLocator.trim(),
        `${row.evidenceId}: evidenceLocator`,
      ).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceSummary", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(
        row.evidenceSummary.trim(),
        `${row.evidenceId}: evidenceSummary`,
      ).not.toBe("");
    }
  });

  it("every row has non-empty boundaryNotes", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(
        row.boundaryNotes.length,
        `${row.evidenceId}: boundaryNotes must be non-empty`,
      ).toBeGreaterThan(0);
      for (const note of row.boundaryNotes) {
        expect(note.trim()).not.toBe("");
      }
    }
  });

  it("every evidenceId is unique", () => {
    const seen = new Set<string>();
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(
        seen.has(row.evidenceId),
        `duplicate evidenceId ${row.evidenceId}`,
      ).toBe(false);
      seen.add(row.evidenceId);
    }
  });

  it("every row's boundaryNotes preserve recommendation/explanation/draft/proof distinctions", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      const combined = row.boundaryNotes.join(" \n ").toLowerCase();
      for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
        expect(
          combined.includes(phrase),
          `${row.evidenceId}: boundaryNotes must include "${phrase}"`,
        ).toBe(true);
      }
    }
  });

  it("no row authorizes auto-write, auto-send, execution authority, LLM ranking, or schema design", () => {
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.evidenceId}: field contains forbidden authorization pattern "${pattern}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("cites all required repo-truth locators across the matrix", () => {
    const allLocators = EMAIL_THREAD_DEDUP_EVIDENCE.map(
      (row) => row.evidenceLocator,
    ).join(" | ");
    for (const locator of REQUIRED_REPO_TRUTH_LOCATORS) {
      expect(
        allLocators.includes(locator),
        `Required repo-truth locator "${locator}" must be cited at least once`,
      ).toBe(true);
    }
  });

  it("includes evidence rows that cover both producers", () => {
    const producers = new Set<string>();
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      if (row.relatedProducer) {
        producers.add(row.relatedProducer);
      }
    }
    expect(producers.has("loadWaitingEmailThreads_generic")).toBe(true);
    expect(producers.has("tpqr004_crm_linked")).toBe(true);
  });

  it("records the existing read-model query shape with no opportunityId filter", () => {
    const queryShapeRows = EMAIL_THREAD_DEDUP_EVIDENCE.filter(
      (row) =>
        row.evidenceKind === "existing_read_model_query_shape" &&
        row.relatedProducer === "loadWaitingEmailThreads_generic",
    );
    expect(queryShapeRows.length).toBeGreaterThan(0);
    for (const row of queryShapeRows) {
      const combined = row.evidenceSummary.toLowerCase();
      expect(combined.includes("workspaceid")).toBe(true);
      expect(combined.includes("waiting_us")).toBe(true);
      expect(combined.includes("no opportunityid filter")).toBe(true);
    }
  });

  it("records the existing read-model id shape using waiting-thread-${thread.id}", () => {
    const idShapeRows = EMAIL_THREAD_DEDUP_EVIDENCE.filter(
      (row) => row.evidenceKind === "existing_read_model_id_shape",
    );
    expect(idShapeRows.length).toBeGreaterThan(0);
    for (const row of idShapeRows) {
      expect(row.evidenceSummary.includes("waiting-thread-${thread.id}")).toBe(
        true,
      );
    }
  });

  it("records the proposed TPQR-004 query shape with the four key clauses", () => {
    const proposedRows = EMAIL_THREAD_DEDUP_EVIDENCE.filter(
      (row) => row.evidenceKind === "proposed_tpqr004_query_shape",
    );
    expect(proposedRows.length).toBeGreaterThan(0);
    for (const row of proposedRows) {
      const lower = row.evidenceSummary.toLowerCase();
      expect(lower.includes("workspaceid")).toBe(true);
      expect(lower.includes("opportunityid is not null")).toBe(true);
      expect(lower.includes("'waiting_us'")).toBe(true);
      expect(lower.includes("opportunity.stage not in ('done','lost')")).toBe(
        true,
      );
      expect(
        lower.includes("opportunity.updatedat < now() - interval '7 days'"),
      ).toBe(true);
    }
  });

  it("evidenceKind values are within the allowed vocabulary", () => {
    const allowedKinds = new Set([
      "existing_read_model_call_site",
      "existing_read_model_query_shape",
      "existing_read_model_id_shape",
      "proposed_tpqr004_query_shape",
      "schema_locator",
      "dedup_requirement_doc",
      "ownership_design_note",
    ]);
    for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
      expect(allowedKinds.has(row.evidenceKind), row.evidenceId).toBe(true);
    }
  });
});

describe("OWNERSHIP_RULE_SELECTION", () => {
  it("selects merge_and_dedup_by_email_thread_id_after_producers", () => {
    expect(SELECTED_OWNERSHIP_RULE).toBe(
      "merge_and_dedup_by_email_thread_id_after_producers",
    );
    expect(OWNERSHIP_RULE_SELECTION.selectedRule).toBe(
      "merge_and_dedup_by_email_thread_id_after_producers",
    );
  });

  it("uses TPQR-004 first then loadWaitingEmailThreads_generic as the tie-break", () => {
    expect(OWNERSHIP_RULE_SELECTION.tieBreakOrder).toEqual([
      "tpqr004_crm_linked",
      "loadWaitingEmailThreads_generic",
    ]);
  });

  it("rationale is non-empty and references both candidate rules", () => {
    expect(OWNERSHIP_RULE_SELECTION.rationale.trim()).not.toBe("");
    const lower = OWNERSHIP_RULE_SELECTION.rationale.toLowerCase();
    expect(
      lower.includes("merge_and_dedup_by_email_thread_id_after_producers"),
    ).toBe(true);
    expect(
      lower.includes("loadwaitingemailthreads"),
    ).toBe(true);
  });

  it("rationale carries no forbidden authorization wording", () => {
    const lower = OWNERSHIP_RULE_SELECTION.rationale.toLowerCase();
    for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
      expect(
        lower.includes(pattern),
        `rationale contains forbidden pattern "${pattern}"`,
      ).toBe(false);
    }
  });
});

describe("mergeAndDedupByEmailThreadId", () => {
  it("collapses overlapping same emailThread.id to one TPQR-004 item", () => {
    const items: PlanningEmailThreadItem[] = [
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_1",
        itemId: "waiting-thread-em_1",
        opportunityIdPresent: true,
      },
      {
        producer: "tpqr004_crm_linked",
        emailThreadId: "em_1",
        itemId: "tpqr004-em_1",
        opportunityIdPresent: true,
      },
    ];
    const merged = mergeAndDedupByEmailThreadId(items);
    expect(merged).toHaveLength(1);
    expect(merged[0].emailThreadId).toBe("em_1");
    expect(merged[0].producer).toBe("tpqr004_crm_linked");
    expect(merged[0].itemId).toBe("tpqr004-em_1");
  });

  it("collapses overlapping in either input order to the TPQR-004 item", () => {
    const reverseOrder: PlanningEmailThreadItem[] = [
      {
        producer: "tpqr004_crm_linked",
        emailThreadId: "em_1",
        itemId: "tpqr004-em_1",
        opportunityIdPresent: true,
      },
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_1",
        itemId: "waiting-thread-em_1",
        opportunityIdPresent: true,
      },
    ];
    const merged = mergeAndDedupByEmailThreadId(reverseOrder);
    expect(merged).toHaveLength(1);
    expect(merged[0].producer).toBe("tpqr004_crm_linked");
  });

  it("keeps non-overlapping items unchanged in both producers", () => {
    const items: PlanningEmailThreadItem[] = [
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_a",
        itemId: "waiting-thread-em_a",
        opportunityIdPresent: false,
      },
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_b",
        itemId: "waiting-thread-em_b",
        opportunityIdPresent: false,
      },
      {
        producer: "tpqr004_crm_linked",
        emailThreadId: "em_c",
        itemId: "tpqr004-em_c",
        opportunityIdPresent: true,
      },
    ];
    const merged = mergeAndDedupByEmailThreadId(items);
    expect(merged).toHaveLength(3);
    const ids = merged.map((m) => m.emailThreadId);
    expect(ids).toEqual(["em_a", "em_b", "em_c"]);
    const producerByThread = new Map(merged.map((m) => [m.emailThreadId, m.producer]));
    expect(producerByThread.get("em_a")).toBe("loadWaitingEmailThreads_generic");
    expect(producerByThread.get("em_b")).toBe("loadWaitingEmailThreads_generic");
    expect(producerByThread.get("em_c")).toBe("tpqr004_crm_linked");
  });

  it("falls back to the generic waiting-thread item when no TPQR-004 item exists for that emailThread.id", () => {
    const items: PlanningEmailThreadItem[] = [
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_only_generic",
        itemId: "waiting-thread-em_only_generic",
        opportunityIdPresent: false,
      },
    ];
    const merged = mergeAndDedupByEmailThreadId(items);
    expect(merged).toHaveLength(1);
    expect(merged[0].producer).toBe("loadWaitingEmailThreads_generic");
  });

  it("produces no duplicate emailThread.id in the final merged output across a mixed input", () => {
    const items: PlanningEmailThreadItem[] = [
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_overlap",
        itemId: "waiting-thread-em_overlap",
        opportunityIdPresent: true,
      },
      {
        producer: "tpqr004_crm_linked",
        emailThreadId: "em_overlap",
        itemId: "tpqr004-em_overlap",
        opportunityIdPresent: true,
      },
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_generic_only",
        itemId: "waiting-thread-em_generic_only",
        opportunityIdPresent: false,
      },
      {
        producer: "tpqr004_crm_linked",
        emailThreadId: "em_tpqr004_only",
        itemId: "tpqr004-em_tpqr004_only",
        opportunityIdPresent: true,
      },
    ];
    const merged = mergeAndDedupByEmailThreadId(items);
    const ids = merged.map((m) => m.emailThreadId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["em_overlap", "em_generic_only", "em_tpqr004_only"]);
  });

  it("returns an empty array when the input is empty", () => {
    expect(mergeAndDedupByEmailThreadId([])).toHaveLength(0);
  });

  it("preserves first-seen order across emailThread.id keys", () => {
    const items: PlanningEmailThreadItem[] = [
      {
        producer: "tpqr004_crm_linked",
        emailThreadId: "em_first",
        itemId: "tpqr004-em_first",
        opportunityIdPresent: true,
      },
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_second",
        itemId: "waiting-thread-em_second",
        opportunityIdPresent: false,
      },
      {
        producer: "loadWaitingEmailThreads_generic",
        emailThreadId: "em_first",
        itemId: "waiting-thread-em_first",
        opportunityIdPresent: true,
      },
    ];
    const merged = mergeAndDedupByEmailThreadId(items);
    expect(merged.map((m) => m.emailThreadId)).toEqual(["em_first", "em_second"]);
    expect(merged[0].producer).toBe("tpqr004_crm_linked");
  });
});

describe("evaluateEmailThreadDedupDesign", () => {
  it("all evaluator checks pass against the current evidence matrix", () => {
    const result = evaluateEmailThreadDedupDesign();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`,
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("totalRows matches the matrix length", () => {
    const result = evaluateEmailThreadDedupDesign();
    expect(result.totalRows).toBe(EMAIL_THREAD_DEDUP_EVIDENCE.length);
  });

  it("selectedRule is merge_and_dedup_by_email_thread_id_after_producers", () => {
    const result = evaluateEmailThreadDedupDesign();
    expect(result.selectedRule).toBe(
      "merge_and_dedup_by_email_thread_id_after_producers",
    );
  });

  it("tieBreakOrder is TPQR-004 first then loadWaitingEmailThreads_generic", () => {
    const result = evaluateEmailThreadDedupDesign();
    expect(result.tieBreakOrder).toEqual([
      "tpqr004_crm_linked",
      "loadWaitingEmailThreads_generic",
    ]);
  });

  it("producersCovered includes both producers", () => {
    const result = evaluateEmailThreadDedupDesign();
    expect(result.producersCovered).toContain("loadWaitingEmailThreads_generic");
    expect(result.producersCovered).toContain("tpqr004_crm_linked");
  });

  it("evaluator surfaces 13 checks", () => {
    const result = evaluateEmailThreadDedupDesign();
    expect(result.checks).toHaveLength(13);
  });

  it("each named eval check is present", () => {
    const names = new Set(
      evaluateEmailThreadDedupDesign().checks.map((c) => c.checkName),
    );
    expect(names.has("ownership_rule_selected")).toBe(true);
    expect(names.has("selected_rule_is_merge_and_dedup_after_producers")).toBe(
      true,
    );
    expect(names.has("tie_break_is_tpqr004_first_then_generic_fallback")).toBe(
      true,
    );
    expect(names.has("no_duplicate_email_thread_id_in_final_merged_output")).toBe(
      true,
    );
    expect(names.has("repo_truth_locators_cited")).toBe(true);
    expect(
      names.has("boundary_notes_preserve_recommendation_explanation_draft_proof"),
    ).toBe(true);
    expect(
      names.has("no_row_grants_runtime_schema_or_execution_authority"),
    ).toBe(true);
    expect(names.has("ownership_design_note_refuses_runtime_adoption")).toBe(
      true,
    );
    expect(names.has("both_producers_covered_by_evidence")).toBe(true);
  });
});
