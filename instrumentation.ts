export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    logInstrumentationInfo("skip server cron registration", {
      nextRuntime: process.env.NEXT_RUNTIME ?? null,
    });
    return;
  }

  // Composition root (repo-split Step 5A): wire Packs/Overlays into the Core
  // registry via the generic bootstrap aggregator. Core names NO tenant here.
  // `extensions/pack-bootstrap` is a PRIVATE_FILE, so the public Core mirror
  // omits it. Keep the import path non-literal so public typecheck/build does
  // not require the private bootstrap file; runtime absence still degrades to
  // Core-only behavior. That degradation is intentional.
  try {
    const packBootstrapPath = ["@/extensions", "pack-bootstrap"].join("/");
    const { registerAllPacks } = (await import(packBootstrapPath)) as {
      registerAllPacks: () => void;
    };
    registerAllPacks();
    logInstrumentationInfo("registered pack contributions");
  } catch (err) {
    logInstrumentationInfo("no pack bootstrap present; running Core-only", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const { startEngineeringDeliveryReviewCron } = await import(
    "@/lib/reports/engineering-delivery-review-cron"
  );

  startEngineeringDeliveryReviewCron();

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

  if (process.env.SIGNAL_COLLECTION_SCHEDULER_ENABLED?.trim().toLowerCase() === "true") {
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
