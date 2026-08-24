import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

const EXPECTED_BINDINGS = {
  llm_provider: ["lib/llm/openai-adapter.ts"],
  engineering_review_cron: [
    "lib/reports/engineering-delivery-review-cron.ts",
    "lib/reports/engineering-delivery-review-refresh.ts",
  ],
  signal_runtime_write: [
    "instrumentation.ts",
    "app/api/runtime/signals/collect/route.ts",
    "lib/extensions/registry.tsx",
    "lib/signal-collection/scheduler.ts",
    "lib/bi-report-skill/business-signal.ts",
    "lib/bi-report-skill/handoff-decision.ts",
    "lib/bi-report-skill/handoff-execution-log.ts",
    "lib/bi-report-skill/operating-closure-kernel.ts",
    "lib/bi-report-skill/signal-notification.ts",
  ],
  dingtalk_sync: [
    "app/api/runtime/dingtalk/hourly-sync/route.ts",
    "lib/connectors/dingtalk-ingestion.ts",
  ],
  dingtalk_bridge: [
    "lib/connectors/dingtalk-ingestion.ts",
    "lib/connectors/dingtalk-workflow-bridge.ts",
  ],
  customer_visible_send: [
    "features/settings/actions.ts",
    "lib/connectors/dingtalk-directory-invite.ts",
    "lib/notifications/system-mail.ts",
    "lib/bi-report-skill/signal-notification-dispatcher.ts",
  ],
  financial_action: [
    "features/settings/actions.ts",
    "lib/billing/integration.ts",
    "lib/billing/stripe.ts",
    "lib/billing/alipay.ts",
    "lib/billing/wechat-pay.ts",
    "app/api/billing/stripe/webhook/route.ts",
    "app/api/billing/alipay/notify/route.ts",
    "app/api/billing/wechat-pay/notify/route.ts",
  ],
} as const;

describe("deployment capability source bindings", () => {
  it.each(Object.entries(EXPECTED_BINDINGS))(
    "binds %s at every declared entry or sink",
    (capability, files) => {
      for (const file of files) {
        const source = readFileSync(path.join(REPO_ROOT, file), "utf8");
        expect(source, `${capability} is not bound in ${file}`).toContain(
          `"${capability}"`,
        );
      }
    },
  );

  it.each(["outbound_voice_asr", "automated_customer_call", "sms_send"])(
    "keeps unimplemented %s capability unbound in production source",
    (capability) => {
      const bindings = listProductionSourceFiles()
        .filter((file) => file !== "lib/runtime/deployment-capabilities.ts")
        .filter((file) => {
          const source = readFileSync(path.join(REPO_ROOT, file), "utf8");
          return (
            source.includes(`assertDeploymentCapabilityEnabled("${capability}")`) ||
            source.includes(`isDeploymentCapabilityEnabled("${capability}")`)
          );
        });

      expect(bindings).toEqual([]);
    },
  );
});

function listProductionSourceFiles() {
  return ["app", "features", "lib"]
    .flatMap((directory) => walkSourceDirectory(directory))
    .concat("instrumentation.ts");
}

function walkSourceDirectory(relativeDirectory: string): string[] {
  const absoluteDirectory = path.join(REPO_ROOT, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return walkSourceDirectory(relativePath);
    if (!entry.isFile()) return [];
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return [];
    if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [relativePath];
  });
}
