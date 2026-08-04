import { z } from "zod";

/**
 * Offline OCR/ASR worker manifest contracts.
 *
 * The multimodal worker ships as a fully pinned, offline bundle:
 * - no network access at runtime;
 * - no runtime downloads (runtimeDownloadAllowed is the LITERAL false —
 *   a manifest claiming true does not parse);
 * - no cloud fallback (cloudFallbackAllowed literal false — substituting a
 *   cloud OCR service, e.g. Baidu cloud OCR, is banned at the schema level);
 * - no VLM included, and semantic claims are limited to what the pinned
 *   components actually do (see capability-claims.ts).
 */
export const CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION =
  "helm.caio.multimodal-worker-manifest.v1";

export const CAIO_MULTIMODAL_WORKER_KINDS = ["ocr", "asr", "media"] as const;
export const caioMultimodalWorkerKindSchema = z.enum(
  CAIO_MULTIMODAL_WORKER_KINDS,
);
export type CaioMultimodalWorkerKind = z.infer<
  typeof caioMultimodalWorkerKindSchema
>;

export const CAIO_MULTIMODAL_COMPONENT_KINDS = [
  "wheel",
  "binary",
  "model",
  "license",
] as const;
export const CAIO_MULTIMODAL_WORKER_PLATFORM = "darwin-arm64";

export const caioMultimodalComponentSchema = z
  .object({
    name: z.string().min(1).max(200),
    version: z.string().min(1).max(100),
    platform: z.literal(CAIO_MULTIMODAL_WORKER_PLATFORM),
    kind: z.enum(CAIO_MULTIMODAL_COMPONENT_KINDS),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().positive(),
    licenseKey: z.string().min(1).max(200),
    sourceNote: z.string().min(1).max(1000),
  })
  .strict();
export type CaioMultimodalComponent = z.infer<
  typeof caioMultimodalComponentSchema
>;

/**
 * Candidate pins for the offline worker bundle: expected component
 * names + versions. These are the ONLY versions a release may ship; a
 * verification failure blocks the release — it is never resolved by
 * swapping in a newer version on site (阻止发布，不现场改用最新版).
 */
export const CAIO_MULTIMODAL_CANDIDATE_PINS = {
  paddleocr: { name: "paddleocr", version: "3.5.0", kind: "wheel" },
  paddlepaddle: {
    // arm64 CPU build for darwin-arm64; no GPU variant is pinned.
    name: "paddlepaddle",
    version: "3.3.0",
    kind: "wheel",
  },
  ppOcrV5: { name: "pp-ocrv5", version: "5.0.0", kind: "model" },
  ppStructureV3: { name: "pp-structurev3", version: "3.0.0", kind: "model" },
  whisperCpp: { name: "whisper.cpp", version: "1.8.1", kind: "binary" },
  whisperModelBilingual: {
    // Bundled bilingual (zh/en) transcription model.
    name: "whisper-large-v3-turbo-bilingual",
    version: "1.8.1-bundled",
    kind: "model",
  },
  ffmpeg: {
    // Pinned static FFmpeg build for media normalization.
    name: "ffmpeg",
    version: "7.1-helm-pinned-20260729",
    kind: "binary",
  },
} as const satisfies Record<
  string,
  { name: string; version: string; kind: (typeof CAIO_MULTIMODAL_COMPONENT_KINDS)[number] }
>;

export const caioMultimodalWorkerManifestSchema = z
  .object({
    schemaVersion: z.literal(CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION),
    workerKind: caioMultimodalWorkerKindSchema,
    components: z.array(caioMultimodalComponentSchema).min(1),
    /** Literal false: a manifest that allows runtime downloads is invalid. */
    runtimeDownloadAllowed: z.literal(false),
    /** Literal false: the cloud-OCR substitution ban (e.g. Baidu cloud OCR). */
    cloudFallbackAllowed: z.literal(false),
    /** Literal false: no general vision-language model ships in this bundle. */
    vlmIncluded: z.literal(false),
    /** Literal true: semantic capability claims stay inside the pinned scope. */
    semanticClaimsLimited: z.literal(true),
  })
  .strict();
export type CaioMultimodalWorkerManifest = z.infer<
  typeof caioMultimodalWorkerManifestSchema
>;
