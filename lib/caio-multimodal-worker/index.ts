export {
  CAIO_MULTIMODAL_CANDIDATE_PINS,
  CAIO_MULTIMODAL_COMPONENT_KINDS,
  CAIO_MULTIMODAL_WORKER_KINDS,
  CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
  CAIO_MULTIMODAL_WORKER_PLATFORM,
  caioMultimodalComponentSchema,
  caioMultimodalWorkerKindSchema,
  caioMultimodalWorkerManifestSchema,
  type CaioMultimodalComponent,
  type CaioMultimodalWorkerKind,
  type CaioMultimodalWorkerManifest,
} from "@/lib/caio-multimodal-worker/worker-manifest-contracts";
export {
  verifyWorkerManifestAgainstFiles,
  type CaioWorkerManifestVerification,
} from "@/lib/caio-multimodal-worker/manifest-verification";
export {
  CAIO_MULTIMODAL_EXCLUDED_CLAIMS,
  caioWorkerCapabilityClaimsSchema,
  deriveWorkerCapabilityClaims,
  type CaioWorkerCapabilityClaims,
} from "@/lib/caio-multimodal-worker/capability-claims";
