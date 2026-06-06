import { describe, it, expect } from "vitest";
import { scanFile } from "../profiler/source-scan";
import { proposeMappings } from "../profiler/mapping-proposer";
import { buildReviewPacket } from "./review-packet";
import { redactReviewPacket } from "./redact";

const DDL = `
CREATE TABLE secret_deals (
  id INTEGER PRIMARY KEY,
  deal_name VARCHAR(99),
  amount DECIMAL(10,2),
  stage VARCHAR(20)
);
`;

function packet() {
  const objects = scanFile("private/schema.sql", DDL);
  const candidates = objects.flatMap(proposeMappings);
  return buildReviewPacket({
    run: {
      runId: "r",
      toolVersion: "0.1.0",
      contractVersion: "1.0.0",
      createdAt: "2026-06-07T00:00:00.000Z",
      scopeHash: "h",
      phase: "completed",
      modalities: ["static_source"],
      artifactRefs: [],
      audit: [],
    },
    codeScan: { fileCount: 1, scannedFileCount: 1, skippedFiles: [], objects },
    candidates,
  });
}

describe("redactReviewPacket", () => {
  it("aliases real object/field names and source paths", () => {
    const redacted = redactReviewPacket(packet());
    const json = JSON.stringify(redacted);
    expect(redacted.sensitivity).toBe("REDACTED_SHAREABLE");
    expect(redacted.redactionStatus).toBe("redacted");
    // Real names/paths must not survive.
    expect(json).not.toContain("secret_deals");
    expect(json).not.toContain("deal_name");
    expect(json).not.toContain("private/schema.sql");
    // Structure is preserved: aliased object + candidate still present.
    expect(redacted.codeScan.objects[0].name).toMatch(/^object_\d+$/);
    expect(redacted.candidates.length).toBeGreaterThan(0);
    expect(redacted.candidates[0].targetEntity).toBe("Opportunity");
  });

  it("preserves signal family and confidence", () => {
    const original = packet();
    const redacted = redactReviewPacket(original);
    expect(redacted.candidates[0].confidence).toBe(original.candidates[0].confidence);
    expect(redacted.candidates[0].signalFamily).toBe(original.candidates[0].signalFamily);
  });
});
