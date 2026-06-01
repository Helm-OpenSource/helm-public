import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const webConnectorRoute = readFileSync(
  "app/api/internal-commercialization/fixture-connector/route.ts",
  "utf8",
);

function extractBlock(name: string) {
  const match = schema.match(new RegExp(`${name}\\s+\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing ${name} block in Prisma schema.`);
  return match[1];
}

describe("internal commercialization schema boundary", () => {
  it("keeps next actions as review-safe enum values", () => {
    const actionEnum = extractBlock("enum InternalCommercializationReviewSafeAction");

    expect(actionEnum).toContain("PREPARE_DIAGNOSIS_BRIEF_FOR_REVIEW");
    expect(actionEnum).toContain("PREPARE_TRIAL_SCOPE_DRAFT_FOR_REVIEW");
    expect(actionEnum).toContain("PREPARE_PILOT_SCOPE_PACKET_FOR_REVIEW");
    expect(actionEnum).toContain(
      "PREPARE_CLOSEOUT_REPORT_CANDIDATE_FOR_REVIEW",
    );
    expect(actionEnum).toContain("DOWNGRADE_OR_PAUSE");
    expect(actionEnum).not.toMatch(
      /\b(SEND|BOOK|PUBLISH|DISPATCH|WRITE|TRIGGER|REQUEST|CONTACT)\b/,
    );
  });

  it("keeps offer stages constrained to the commercial lifecycle package", () => {
    const offerStageEnum = extractBlock("enum InternalCommercializationOfferStage");

    expect(offerStageEnum).toContain("DIAGNOSIS_1H");
    expect(offerStageEnum).toContain("TRIAL_7D");
    expect(offerStageEnum).toContain("PILOT_4W");
    expect(offerStageEnum).toContain("CLOSEOUT_REPORT");
    expect(offerStageEnum).not.toMatch(/\b(ALL_INDUSTRY|AUTO_DECISION|DIGITAL_EMPLOYEE)\b/);
  });

  it("keeps the runtime table alias-only instead of storing raw customer PII", () => {
    const runModel = extractBlock("model InternalCommercializationRun");

    expect(runModel).toContain("providerAliasId");
    expect(runModel).toContain("customerOpportunityAliasIds");
    expect(runModel).not.toMatch(
      /\b(email|phone|wechat|address|rawCustomerName|customerName|contactName|companyName)\b/i,
    );
  });

  it("keeps the web fixture connector dry-run only", () => {
    expect(webConnectorRoute).toContain("dry-run only");
    expect(webConnectorRoute).toContain("dryRun: true");
    expect(webConnectorRoute).not.toContain("safeWriteAuditLog");
  });
});
