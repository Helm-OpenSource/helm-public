import { describe, expect, it } from "vitest";

import {
  CAIO_MULTIMODAL_CANDIDATE_PINS,
  CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
  caioMultimodalWorkerManifestSchema,
  type CaioMultimodalWorkerManifest,
} from "@/lib/caio-multimodal-worker/worker-manifest-contracts";

function validManifest(): CaioMultimodalWorkerManifest {
  return {
    schemaVersion: CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
    workerKind: "ocr",
    components: [
      {
        name: CAIO_MULTIMODAL_CANDIDATE_PINS.paddleocr.name,
        version: CAIO_MULTIMODAL_CANDIDATE_PINS.paddleocr.version,
        platform: "darwin-arm64",
        kind: "wheel",
        sha256: "a".repeat(64),
        sizeBytes: 1024,
        licenseKey: "paddleocr-license",
        sourceNote: "pinned from pypi mirror, offline bundle 20260729",
      },
      {
        name: "paddleocr-license",
        version: "apache-2.0",
        platform: "darwin-arm64",
        kind: "license",
        sha256: "b".repeat(64),
        sizeBytes: 11_357,
        licenseKey: "paddleocr-license",
        sourceNote: "upstream LICENSE file",
      },
    ],
    runtimeDownloadAllowed: false,
    cloudFallbackAllowed: false,
    vlmIncluded: false,
    semanticClaimsLimited: true,
  };
}

describe("multimodal worker manifest contracts", () => {
  it("parses a fully pinned offline manifest", () => {
    expect(() =>
      caioMultimodalWorkerManifestSchema.parse(validManifest()),
    ).not.toThrow();
  });

  it("encodes the candidate pins as expected name+version constants", () => {
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.paddleocr).toMatchObject({
      name: "paddleocr",
      version: "3.5.0",
    });
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.paddlepaddle).toMatchObject({
      name: "paddlepaddle",
      version: "3.3.0",
    });
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.ppOcrV5.name).toBe("pp-ocrv5");
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.ppStructureV3.name).toBe(
      "pp-structurev3",
    );
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.whisperCpp).toMatchObject({
      name: "whisper.cpp",
      version: "1.8.1",
    });
    expect(
      CAIO_MULTIMODAL_CANDIDATE_PINS.whisperModelBilingual.kind,
    ).toBe("model");
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.ffmpeg.name).toBe("ffmpeg");
    expect(CAIO_MULTIMODAL_CANDIDATE_PINS.ffmpeg.version).toContain("pinned");
  });

  it("rejects runtimeDownloadAllowed: true — no runtime downloads, ever", () => {
    expect(() =>
      caioMultimodalWorkerManifestSchema.parse({
        ...validManifest(),
        runtimeDownloadAllowed: true,
      }),
    ).toThrow();
  });

  it("rejects cloudFallbackAllowed: true — the cloud-OCR substitution ban", () => {
    expect(() =>
      caioMultimodalWorkerManifestSchema.parse({
        ...validManifest(),
        cloudFallbackAllowed: true,
      }),
    ).toThrow();
  });

  it("rejects vlmIncluded: true and semanticClaimsLimited: false", () => {
    expect(() =>
      caioMultimodalWorkerManifestSchema.parse({
        ...validManifest(),
        vlmIncluded: true,
      }),
    ).toThrow();
    expect(() =>
      caioMultimodalWorkerManifestSchema.parse({
        ...validManifest(),
        semanticClaimsLimited: false,
      }),
    ).toThrow();
  });

  it("rejects extra keys, wrong platform, and malformed hashes", () => {
    expect(() =>
      caioMultimodalWorkerManifestSchema.parse({
        ...validManifest(),
        downloadMirror: "https://example.com",
      }),
    ).toThrow();
    const manifest = validManifest();
    manifest.components[0]!.platform = "linux-x64" as "darwin-arm64";
    expect(() => caioMultimodalWorkerManifestSchema.parse(manifest)).toThrow();
    const badHash = validManifest();
    badHash.components[0]!.sha256 = "not-a-hash";
    expect(() => caioMultimodalWorkerManifestSchema.parse(badHash)).toThrow();
  });
});
