import { describe, expect, it } from "vitest";

import {
  CAIO_MULTIMODAL_EXCLUDED_CLAIMS,
  deriveWorkerCapabilityClaims,
} from "@/lib/caio-multimodal-worker/capability-claims";
import {
  CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
  type CaioMultimodalWorkerKind,
  type CaioMultimodalWorkerManifest,
} from "@/lib/caio-multimodal-worker/worker-manifest-contracts";

function manifest(workerKind: CaioMultimodalWorkerKind): CaioMultimodalWorkerManifest {
  return {
    schemaVersion: CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
    workerKind,
    components: [
      {
        name: "component-a",
        version: "1.0.0",
        platform: "darwin-arm64",
        kind: "binary",
        sha256: "a".repeat(64),
        sizeBytes: 10,
        licenseKey: "component-a-license",
        sourceNote: "test",
      },
    ],
    runtimeDownloadAllowed: false,
    cloudFallbackAllowed: false,
    vlmIncluded: false,
    semanticClaimsLimited: true,
  };
}

describe("worker capability claims", () => {
  it("limits OCR claims to text extraction and document structure", () => {
    const claims = deriveWorkerCapabilityClaims(manifest("ocr"));
    expect(claims.claimsIncluded).toEqual([
      "text_extraction",
      "document_structure",
    ]);
    expect(claims.semanticClaimsLimited).toBe(true);
  });

  it("limits ASR claims to bilingual zh/en transcription", () => {
    const claims = deriveWorkerCapabilityClaims(manifest("asr"));
    expect(claims.claimsIncluded).toEqual(["bilingual_transcription_zh_en"]);
  });

  it("always carries the explicit exclusions for every worker kind", () => {
    for (const kind of ["ocr", "asr", "media"] as const) {
      const claims = deriveWorkerCapabilityClaims(manifest(kind));
      expect(claims.claimsExcluded).toEqual([
        "general_vlm_understanding",
        "image_semantics_without_text",
        "video_semantics_without_speech",
      ]);
      expect(claims.claimsExcluded).toEqual([
        ...CAIO_MULTIMODAL_EXCLUDED_CLAIMS,
      ]);
      // No included claim may contradict an exclusion.
      for (const excluded of claims.claimsExcluded) {
        expect(claims.claimsIncluded).not.toContain(excluded);
      }
    }
  });

  it("refuses to derive claims from an invalid manifest", () => {
    expect(() =>
      deriveWorkerCapabilityClaims({
        ...manifest("ocr"),
        cloudFallbackAllowed: true,
      } as unknown as CaioMultimodalWorkerManifest),
    ).toThrow();
  });
});
