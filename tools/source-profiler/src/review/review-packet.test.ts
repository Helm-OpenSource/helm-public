import { describe, it, expect } from "vitest";
import { scanFile } from "../profiler/source-scan";
import { proposeMappings } from "../profiler/mapping-proposer";
import { buildReviewPacket } from "./review-packet";
import { reviewPacketSchema } from "../contract/review-packet";

const DDL =
  "CREATE TABLE deals (id INTEGER PRIMARY KEY, name VARCHAR(99), amount DECIMAL(10,2), stage VARCHAR(20));";

function sampleResult() {
  const objects = scanFile("schema.sql", DDL);
  const candidates = objects.flatMap(proposeMappings);
  const run = {
    runId: "run-1",
    toolVersion: "0.1.0",
    contractVersion: "1.0.0",
    createdAt: "2026-06-07T00:00:00.000Z",
    scopeHash: "hash",
    phase: "completed" as const,
    modalities: ["static_source" as const],
    artifactRefs: [],
    audit: [],
  };
  const codeScan = { fileCount: 1, scannedFileCount: 1, skippedFiles: [], objects };
  return { run, codeScan, candidates };
}

describe("buildReviewPacket", () => {
  it("produces a valid CONFIDENTIAL packet with P0-REQ-07 metadata", () => {
    const { run, codeScan, candidates } = sampleResult();
    const packet = buildReviewPacket({ run, codeScan, candidates, workspace: "ws-1" });
    expect(() => reviewPacketSchema.parse(packet)).not.toThrow();
    expect(packet.sensitivity).toBe("CONFIDENTIAL");
    expect(packet.humanReviewState).toBe("pending_review");
    expect(packet.requiredMetadata.provider).toBe("source-profiler");
    expect(packet.requiredMetadata.workspace).toBe("ws-1");
    expect(packet.requiredMetadata.traceId).toBe("run-1");
    expect(packet.requiredMetadata.rawOutputHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
