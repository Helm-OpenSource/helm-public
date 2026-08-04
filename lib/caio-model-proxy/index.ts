// CAIO model proxy — public barrel.

export {
  CAIO_ALIAS_BINDING_STATUSES,
  CAIO_CODEX_DEFAULT_ALIAS,
  CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS,
  CAIO_MODEL_PROTOCOLS,
  CAIO_STABLE_MODEL_ALIASES,
  CAIO_WORKBUDDY_DEFAULT_ALIAS,
  caioAliasBindingStatusSchema,
  caioCredentialRefSchema,
  caioModelAliasBindingSchema,
  caioModelAliasFallbackCandidateSchema,
  caioModelAliasSchema,
  caioModelProtocolSchema,
  caioDefaultGrantedAliases,
  isFallbackAllowed,
  listModelsForGrant,
  resolveCaioGrantedAliases,
  type CaioAliasBindingStatus,
  type CaioFallbackEquivalenceDimension,
  type CaioModelAliasBinding,
  type CaioModelAliasFallbackCandidate,
  type CaioModelListEntry,
  type CaioModelListResponse,
  type CaioModelProtocol,
} from "./alias-contracts";

export {
  CAIO_CREDENTIAL_ERROR_CODES,
  CAIO_CREDENTIAL_MAX_BYTES,
  CAIO_CREDENTIAL_REF_PATTERN,
  CaioCredentialError,
  SAME_UID_ISOLATION_DISCLAIMER,
  completeRotation,
  loadCredential,
  rotateCredentialFile,
  type CaioCredentialErrorCode,
  type CaioCredentialRotationCompletion,
  type CaioCredentialRotationResult,
} from "./credential-file";

export {
  CAIO_UPSTREAM_ERROR_CODES,
  gatewayStatusForUpstreamError,
  mapUpstreamHttpError,
  type CaioProxyUpstreamClientPort,
  type CaioProxyUpstreamInvocation,
  type CaioUpstreamErrorCode,
  type CaioUpstreamErrorInfo,
  type CaioUpstreamInvokeResult,
} from "./upstream/upstream-contracts";

export {
  CaioResponsesUpstreamClient,
  createCaioResponsesUpstreamPort,
  type CaioResponsesUpstreamClientOptions,
} from "./upstream/responses-client";

export {
  CaioChatCompletionsUpstreamClient,
  createCaioChatCompletionsUpstreamPort,
  type CaioChatCompletionsUpstreamClientOptions,
} from "./upstream/chat-completions-client";

export {
  CAIO_ROUTE_ADMISSION_DENIALS,
  CAIO_GOVERNED_CREDENTIAL_REF_PREFIX,
  CaioGovernedAdmissionError,
  caioGovernedCredentialRef,
  caioGovernedRetentionPolicyKey,
  type CaioFrozenGovernedAdmissionPort,
  type CaioGovernedAdmissionPort,
  type CaioGovernedAdmissionSnapshot,
  type CaioGovernedRouteAdmission,
  type CaioGovernedRouteVerdict,
  type CaioLiveGovernedAdmissionPort,
  type CaioRouteAdmissionDenial,
} from "./governed-admission-contracts";

export {
  CAIO_GOVERNED_ADMISSION_DIMENSIONS,
  admitFromSnapshot,
  admitLiveRoute,
  assertBindingAdmitted,
  compareBindingToGovernedRoute,
  type CaioGovernedAdmissionDimension,
  type CaioGovernedAdmissionSubject,
} from "./governed-admission-gate";

export {
  createCaioFrozenGovernedAdmission,
  createCaioLiveGovernedAdmission,
  resolveCaioGovernedAdmissionSnapshot,
  type CaioGovernedAdmissionSource,
  type CaioGovernedAdmissionTransactionRunner,
} from "./governed-route-admission.service";

export {
  CAIO_OUTBOUND_DENY_CATEGORIES,
  CaioOutboundContentDeniedError,
  assertCaioOutboundContentAllowed,
  assessCaioOutboundContent,
  type CaioOutboundContentAssessment,
} from "./outbound-content-gate";

export {
  CAIO_PROXY_CLIENT_TYPES,
  CaioModelProxyConfigError,
  createCaioModelProxy,
  type CaioAudienceContext,
  type CaioCredentialLoaderPort,
  type CaioModelProxy,
  type CaioModelProxyDependencies,
  type CaioProxyAuditRefusal,
  type CaioProxyAuditRefusalStatus,
  type CaioProxyClientType,
  type CaioProxyExecuteInput,
  type CaioProxyExecuteResult,
  type CaioProxyExecuteStatus,
  type CaioProxyUpstreamDescriptor,
  type CaioRateLimiterPort,
  type CaioRateLimitDecision,
} from "./proxy-engine";
