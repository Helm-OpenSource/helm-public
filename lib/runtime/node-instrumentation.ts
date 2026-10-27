import { isDeploymentCapabilityEnabled } from "@/lib/runtime/deployment-capabilities";
import { serverBootstrapBinding } from "@/lib/runtime/server-bootstrap-binding";
import { createServerBootstrapInitializer } from "@/lib/runtime/server-bootstrap";

type BootstrapMode = "legacy-optional" | "disabled" | "required";
type BootstrapStatus = "legacy-core-only" | "legacy-registered" | "disabled" | "initialized";
type BootstrapResult = Readonly<{ mode: BootstrapMode; status: BootstrapStatus }>;
type BootstrapInitializer = () => Promise<BootstrapResult>;
type BootstrapLoader = () => Promise<{ registerAllPacks?: unknown; serverBootstrapVersion?: unknown; serverBootstrapMode?: unknown; registerServerBootstrap?: unknown }>;
declare global { var __helmServerBootstrapAdmission: Readonly<{ policy: string; initialize: BootstrapInitializer }> | undefined; }

export async function registerNodeInstrumentation() {
  const policy = JSON.stringify(serverBootstrapBinding);
  if (globalThis.__helmServerBootstrapAdmission?.policy !== undefined && globalThis.__helmServerBootstrapAdmission.policy !== policy) throw new Error("server_bootstrap_binding_refused");
  // Preserve the fixed assembly slot in the same public-safe form used by base instrumentation.ts.
  // @ts-ignore This source-only slot is provided by the assembled application.
  const packBootstrapPath = ["@/extensions", "pack-bootstrap"].join("/");
  const loadPackBootstrap: BootstrapLoader = () => import(packBootstrapPath);
  const admission = globalThis.__helmServerBootstrapAdmission ??= Object.freeze({ policy, initialize: createServerBootstrapInitializer(serverBootstrapBinding, loadPackBootstrap) });
  // This fixed slot is supplied by the assembled application. Public mirror
  // preflight projects this literal into its fixed legacy-optional seam.
  // Versioned initialization is awaited before downstream startup. Required
  // failure propagates; it must never become a Core-only success. The fixed
  // source slot cannot be selected by request data or environment variables.
  const bootstrap = await admission.initialize();
  logInstrumentationInfo("server bootstrap admission", bootstrap);

  const { startEngineeringDeliveryReviewCron } = await import(
    "@/lib/reports/engineering-delivery-review-cron"
  );

  startEngineeringDeliveryReviewCron();

  // Advice-only follow-through sweep for the light task chain (ActionItem /
  // Commitment). Opt-in via LIGHT_CHAIN_FOLLOW_THROUGH_CRON_ENABLED; internal
  // notifications and audit only, no external send.
  const { startLightChainFollowThroughCron } = await import(
    "@/lib/task-follow-through/light-chain-follow-through-cron"
  );

  startLightChainFollowThroughCron();

  // T019.code P0 #2b — wire DB-derived spend provider so the LLM
  // spend-tracker can use max(in-memory, DB) on multi-instance
  // deployments. The provider is cached with 60s TTL inside spend-tracker;
  // a DB-unavailable error falls back to in-memory only.
  // See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 3.
  try {
    const [{ setDBDerivedSpendProvider }, { deriveMonthToDateSpendUSDFromCallLog }, { db }] = await Promise.all([
      import("@/lib/llm/spend-tracker"),
      import("@/lib/llm/spend-budget-db-derivation"),
      import("@/lib/db"),
    ]);
    setDBDerivedSpendProvider(async ({ workspaceId, monthKey }) =>
      deriveMonthToDateSpendUSDFromCallLog({
        client: db.lLMCallLog,
        workspaceId,
        monthKey,
      }),
    );
    logInstrumentationInfo("registered DB-derived LLM spend provider");
  } catch (err) {
    logInstrumentationInfo("failed to register DB-derived LLM spend provider; falling back to in-memory only", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (
    process.env.SIGNAL_COLLECTION_SCHEDULER_ENABLED?.trim().toLowerCase() === "true" &&
    isDeploymentCapabilityEnabled("signal_runtime_write")
  ) {
    logInstrumentationInfo("starting signal collection scheduler");
    const { startRegisteredSignalCollectionScheduler } = await import(
      "@/lib/extensions/registry"
    );
    startRegisteredSignalCollectionScheduler();
  } else {
    logInstrumentationInfo("signal collection scheduler disabled", {
      signalCollectionSchedulerEnabled:
        process.env.SIGNAL_COLLECTION_SCHEDULER_ENABLED ?? null,
    });
  }

}

function logInstrumentationInfo(message: string, details?: Record<string, unknown>) {
  if (!details) {
    console.info(`[instrumentation] ${message}`);
    return;
  }
  console.info(`[instrumentation] ${message} ${JSON.stringify(details)}`);
}
