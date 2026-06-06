import { describe, it, expect } from "vitest";
import { scanFile } from "../profiler/source-scan";
import { proposeMappings } from "../profiler/mapping-proposer";
import { buildReviewPacket } from "../review/review-packet";
import { buildOverlayDraft } from "./overlay-draft";
import { overlayPatchDraftSchema } from "../contract/overlay";

function samplePacket() {
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

describe("buildOverlayDraft", () => {
  it("emits scaffold files and an inert connector draft", () => {
    const draft = buildOverlayDraft({
      packet: samplePacket(),
      tenantKey: "acme",
      extensionSlug: "acme-crm",
      overlayRoot: "(not-materialized)",
    });
    expect(() => overlayPatchDraftSchema.parse(draft)).not.toThrow();
    expect(draft.materialized).toBe(false);
    expect(draft.connectorDraft?.activated).toBe(false);
    expect(draft.connectorDraft?.posture).toBe("read_only");

    const intents = draft.files.map((f) => f.intent);
    expect(intents).toEqual(
      expect.arrayContaining([
        "extension_manifest_patch",
        "readonly_adapter_skeleton",
        "mapping_candidates",
        "review_packet_doc",
        "synthetic_test",
      ]),
    );
    for (const file of draft.files) {
      expect(file.path.startsWith("tenants/acme/extensions/acme-crm/")).toBe(true);
    }
  });
});
