import { describe, it, expect } from "vitest";
import { scanFile } from "../profiler/source-scan";
import { proposeMappings } from "../profiler/mapping-proposer";
import { buildReviewPacket } from "../review/review-packet";
import { runAiOverlay } from "./overlay";
import { createRemoteProvider } from "./remote-provider";
import type { AiProvider } from "./types";

function packet() {
  const objects = scanFile(
    "schema.sql",
    "CREATE TABLE deals (id INTEGER PRIMARY KEY, name VARCHAR(99), amount DECIMAL(10,2), stage VARCHAR(20));",
  );
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

const fixedNow = () => new Date("2026-06-07T00:00:00.000Z");

describe("runAiOverlay — local provider", () => {
  it("produces advisory candidate-only mappings with origin ai", async () => {
    const out = await runAiOverlay({ packet: packet(), providerKind: "local", consent: false, now: fixedNow });
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.candidates.every((c) => c.origin === "ai")).toBe(true);
    expect(out.candidates.every((c) => c.state === "candidate")).toBe(true);
    expect(out.promptPreview).toContain("redacted-only");
  });
});

describe("runAiOverlay — remote consent ceremony", () => {
  it("blocks remote without consent and emits no candidates", async () => {
    const out = await runAiOverlay({ packet: packet(), providerKind: "openai", consent: false, now: fixedNow });
    expect(out.candidates).toEqual([]);
    expect(out.audit.some((a) => a.level === "warn" && /consent/i.test(a.message))).toBe(true);
  });

  it("dispatches a REDACTED prompt to a consented remote provider", async () => {
    let sentPrompt = "";
    const transport = async (prompt: string) => {
      sentPrompt = prompt;
      const obj = packet().candidates[0];
      return JSON.stringify([
        {
          sourceObjectId: obj.sourceObjectId,
          targetEntity: "Opportunity",
          signalFamily: "advancement",
          reasoning: "looks like a pipeline object",
          confidence: 80,
        },
      ]);
    };
    const provider: AiProvider = createRemoteProvider({ kind: "openai", transport });
    const out = await runAiOverlay({
      packet: packet(),
      providerKind: "openai",
      consent: true,
      provider,
      now: fixedNow,
    });
    expect(out.candidates.length).toBe(1);
    expect(out.candidates[0].origin).toBe("ai");
    // The prompt sent to the transport must not contain the real table name.
    expect(sentPrompt).not.toContain("deals");
  });
});
