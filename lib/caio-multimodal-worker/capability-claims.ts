import { z } from "zod";

import {
  caioMultimodalWorkerManifestSchema,
  type CaioMultimodalWorkerKind,
  type CaioMultimodalWorkerManifest,
} from "@/lib/caio-multimodal-worker/worker-manifest-contracts";

/**
 * Capability claims derived from a valid worker manifest.
 *
 * Claims are deliberately narrow: OCR claims text extraction and document
 * structure only; ASR claims bilingual (zh/en) transcription only; the media
 * worker claims format normalization only. The exclusions are ALWAYS present
 * regardless of worker kind — this bundle never claims general VLM
 * understanding, image semantics without text, or video semantics without
 * speech.
 */
export const CAIO_MULTIMODAL_EXCLUDED_CLAIMS = [
  "general_vlm_understanding",
  "image_semantics_without_text",
  "video_semantics_without_speech",
] as const;

const CLAIMS_BY_KIND: Record<CaioMultimodalWorkerKind, readonly string[]> = {
  ocr: ["text_extraction", "document_structure"],
  asr: ["bilingual_transcription_zh_en"],
  media: ["media_format_normalization"],
};

export const caioWorkerCapabilityClaimsSchema = z
  .object({
    workerKind: z.enum(["ocr", "asr", "media"]),
    claimsIncluded: z.array(z.string().min(1)).min(1),
    claimsExcluded: z
      .array(z.enum(CAIO_MULTIMODAL_EXCLUDED_CLAIMS))
      .length(CAIO_MULTIMODAL_EXCLUDED_CLAIMS.length),
    semanticClaimsLimited: z.literal(true),
  })
  .strict();
export type CaioWorkerCapabilityClaims = z.infer<
  typeof caioWorkerCapabilityClaimsSchema
>;

export function deriveWorkerCapabilityClaims(
  manifest: CaioMultimodalWorkerManifest,
): CaioWorkerCapabilityClaims {
  const parsed = caioMultimodalWorkerManifestSchema.parse(manifest);
  return caioWorkerCapabilityClaimsSchema.parse({
    workerKind: parsed.workerKind,
    claimsIncluded: [...CLAIMS_BY_KIND[parsed.workerKind]],
    claimsExcluded: [...CAIO_MULTIMODAL_EXCLUDED_CLAIMS],
    semanticClaimsLimited: true,
  });
}
