import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const scanRoot = "app/api";
const inventoryDocumentPath =
  "docs/product/HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md";
const sourceExtensions = new Set([".ts", ".tsx"]);
const tenantPrivateExtensionKey = ["guang", "pu"].join("");
const tenantPrivateIntegrationKey = `${["mi", "dun"].join("")}-integrate`;
const tenantPrivateAccountBindingBase = `app/api/extensions/${tenantPrivateExtensionKey}/${tenantPrivateIntegrationKey}/accountBinding`;

const reviewedApiWorkspaceDefaultLocaleEntries = [
  {
    path: "app/api/auth/dingtalk/callback/route.ts",
    documentToken: "app/api/auth/dingtalk/callback/route.ts",
  },
  {
    path: "app/api/auth/dingtalk/start/route.ts",
    documentToken: "app/api/auth/dingtalk/start/route.ts",
  },
  {
    path: "app/api/auth/feishu/callback/route.ts",
    documentToken: "app/api/auth/feishu/callback/route.ts",
  },
  {
    path: "app/api/auth/feishu/start/route.ts",
    documentToken: "app/api/auth/feishu/start/route.ts",
  },
  {
    path: "app/api/auth/wecom/callback/route.ts",
    documentToken: "app/api/auth/wecom/callback/route.ts",
  },
  {
    path: "app/api/auth/wecom/start/route.ts",
    documentToken: "app/api/auth/wecom/start/route.ts",
  },
  {
    path: "app/api/blockers/[id]/resolve/route.ts",
    documentToken: "app/api/blockers/[id]/resolve/route.ts",
  },
  {
    path: "app/api/blockers/[id]/status/route.ts",
    documentToken: "app/api/blockers/[id]/status/route.ts",
  },
  { path: "app/api/blockers/route.ts", documentToken: "app/api/blockers/route.ts" },
  {
    path: "app/api/briefings/meeting/[meetingId]/route.ts",
    documentToken: "app/api/briefings/meeting/[meetingId]/route.ts",
  },
  {
    path: "app/api/commitments/[id]/status/route.ts",
    documentToken: "app/api/commitments/[id]/status/route.ts",
  },
  {
    path: "app/api/commitments/route.ts",
    documentToken: "app/api/commitments/route.ts",
  },
  {
    path: "app/api/connectors/google/start/route.ts",
    documentToken: "app/api/connectors/google/start/route.ts",
  },
  {
    path: "app/api/connectors/hubspot/start/route.ts",
    documentToken: "app/api/connectors/hubspot/start/route.ts",
  },
  {
    path: "app/api/connectors/salesforce/start/route.ts",
    documentToken: "app/api/connectors/salesforce/start/route.ts",
  },
  {
    path: "app/api/conversation-capture/[sessionId]/results/route.ts",
    documentToken:
      "app/api/conversation-capture/[sessionId]/results/route.ts",
  },
  {
    path: "app/api/conversation-capture/[sessionId]/route.ts",
    documentToken: "app/api/conversation-capture/[sessionId]/route.ts",
  },
  {
    path: "app/api/conversation-capture/[sessionId]/stop/route.ts",
    documentToken:
      "app/api/conversation-capture/[sessionId]/stop/route.ts",
  },
  {
    path: "app/api/conversation-capture/ingest/route.ts",
    documentToken: "app/api/conversation-capture/ingest/route.ts",
  },
  {
    path: "app/api/conversation-capture/start/route.ts",
    documentToken: "app/api/conversation-capture/start/route.ts",
  },
  {
    path: "app/api/evolution/delta-events/route.ts",
    documentToken: "app/api/evolution/delta-events/route.ts",
  },
  {
    path: "app/api/evolution/insights/route.ts",
    documentToken: "app/api/evolution/insights/route.ts",
  },
  {
    path: "app/api/evolution/patterns/route.ts",
    documentToken: "app/api/evolution/patterns/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/accept/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/accept/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/approve-formal-review/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/approve-formal-review/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/defer-formal-review/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/defer-formal-review/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/dismiss/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/dismiss/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/queue-formal-review/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/queue-formal-review/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/reject-formal-review/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/reject-formal-review/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/[id]/return-hardening/route.ts",
    documentToken:
      "app/api/evolution/skill-suggestions/[id]/return-hardening/route.ts",
  },
  {
    path: "app/api/evolution/skill-suggestions/route.ts",
    documentToken: "app/api/evolution/skill-suggestions/route.ts",
  },
  {
    path: "app/api/evolution/strategy-suggestions/[id]/accept/route.ts",
    documentToken:
      "app/api/evolution/strategy-suggestions/[id]/accept/route.ts",
  },
  {
    path: "app/api/evolution/strategy-suggestions/[id]/dismiss/route.ts",
    documentToken:
      "app/api/evolution/strategy-suggestions/[id]/dismiss/route.ts",
  },
  {
    path: "app/api/evolution/strategy-suggestions/route.ts",
    documentToken: "app/api/evolution/strategy-suggestions/route.ts",
  },
  {
    path: `${tenantPrivateAccountBindingBase}/callback/route.ts`,
    documentToken:
      "app/api/extensions/<tenant-private>/<tenant-private-integration>/accountBinding/callback/route.ts",
  },
  {
    path: `${tenantPrivateAccountBindingBase}/start/route.ts`,
    documentToken:
      "app/api/extensions/<tenant-private>/<tenant-private-integration>/accountBinding/start/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/artifacts/[id]/confirm/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/artifacts/[id]/confirm/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/checkpoints/[id]/resume/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/checkpoints/[id]/resume/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/sessions/[id]/trace/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/sessions/[id]/trace/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/consolidation/jobs/[id]/status/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/consolidation/jobs/[id]/status/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/consolidation/jobs/route.ts",
    documentToken: "app/api/helm-v2/runtime/consolidation/jobs/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/consolidation/meetings/[meetingId]/queue/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/consolidation/meetings/[meetingId]/queue/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/context/prune/route.ts",
    documentToken: "app/api/helm-v2/runtime/context/prune/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/meetings/ingest/route.ts",
    documentToken: "app/api/helm-v2/runtime/meetings/ingest/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/memory/promote/route.ts",
    documentToken: "app/api/helm-v2/runtime/memory/promote/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/problem-spaces/[id]/assign-dri/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/problem-spaces/[id]/assign-dri/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/problem-spaces/route.ts",
    documentToken: "app/api/helm-v2/runtime/problem-spaces/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/reflection/candidates/[id]/accept/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/reflection/candidates/[id]/accept/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/reflection/candidates/[id]/dismiss/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/reflection/candidates/[id]/dismiss/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/reflection/jobs/[id]/status/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/reflection/jobs/[id]/status/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/reflection/jobs/route.ts",
    documentToken: "app/api/helm-v2/runtime/reflection/jobs/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/reflection/meetings/[meetingId]/queue/route.ts",
    documentToken:
      "app/api/helm-v2/runtime/reflection/meetings/[meetingId]/queue/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/signals/ingest/route.ts",
    documentToken: "app/api/helm-v2/runtime/signals/ingest/route.ts",
  },
  {
    path: "app/api/helm-v2/runtime/verification/run/route.ts",
    documentToken: "app/api/helm-v2/runtime/verification/run/route.ts",
  },
  {
    path: "app/api/imports/conflicts/[id]/resolve/route.ts",
    documentToken: "app/api/imports/conflicts/[id]/resolve/route.ts",
  },
  {
    path: "app/api/imports/crm/preview/route.ts",
    documentToken: "app/api/imports/crm/preview/route.ts",
  },
  {
    path: "app/api/imports/crm/run/route.ts",
    documentToken: "app/api/imports/crm/run/route.ts",
  },
  {
    path: "app/api/imports/crm/sync/route.ts",
    documentToken: "app/api/imports/crm/sync/route.ts",
  },
  {
    path: "app/api/imports/jobs/[jobId]/warmup/route.ts",
    documentToken: "app/api/imports/jobs/[jobId]/warmup/route.ts",
  },
  {
    path: "app/api/internal-commercialization/fixture-connector/route.ts",
    documentToken:
      "app/api/internal-commercialization/fixture-connector/route.ts",
  },
  {
    path: "app/api/internal-commercialization/runs/route.ts",
    documentToken: "app/api/internal-commercialization/runs/route.ts",
  },
  {
    path: "app/api/llm/briefings/[objectType]/[objectId]/route.ts",
    documentToken: "app/api/llm/briefings/[objectType]/[objectId]/route.ts",
  },
  {
    path: "app/api/llm/meetings/[meetingId]/process-memory/route.ts",
    documentToken:
      "app/api/llm/meetings/[meetingId]/process-memory/route.ts",
  },
  {
    path: "app/api/llm/recommendations/[recommendationId]/explain/route.ts",
    documentToken:
      "app/api/llm/recommendations/[recommendationId]/explain/route.ts",
  },
  {
    path: "app/api/memory/export/route.ts",
    documentToken: "app/api/memory/export/route.ts",
  },
  {
    path: "app/api/memory/facts/[id]/confirm/route.ts",
    documentToken: "app/api/memory/facts/[id]/confirm/route.ts",
  },
  {
    path: "app/api/memory/facts/[id]/correct/route.ts",
    documentToken: "app/api/memory/facts/[id]/correct/route.ts",
  },
  {
    path: "app/api/memory/facts/[id]/delete/route.ts",
    documentToken: "app/api/memory/facts/[id]/delete/route.ts",
  },
  {
    path: "app/api/memory/facts/[id]/invalidate/route.ts",
    documentToken: "app/api/memory/facts/[id]/invalidate/route.ts",
  },
  {
    path: "app/api/memory/facts/route.ts",
    documentToken: "app/api/memory/facts/route.ts",
  },
  {
    path: "app/api/memory/imports/meeting-notes/process/route.ts",
    documentToken: "app/api/memory/imports/meeting-notes/process/route.ts",
  },
  {
    path: "app/api/memory/meetings/[meetingId]/process/route.ts",
    documentToken: "app/api/memory/meetings/[meetingId]/process/route.ts",
  },
  {
    path: "app/api/memory/openclaw/status/route.ts",
    documentToken: "app/api/memory/openclaw/status/route.ts",
  },
  {
    path: "app/api/memory/openclaw/sync/route.ts",
    documentToken: "app/api/memory/openclaw/sync/route.ts",
  },
  {
    path: "app/api/opportunities/[id]/attachments/route.ts",
    documentToken: "app/api/opportunities/[id]/attachments/route.ts",
  },
  {
    path: "app/api/recommendations/[id]/feedback/route.ts",
    documentToken: "app/api/recommendations/[id]/feedback/route.ts",
  },
  {
    path: "app/api/recommendations/next-actions/route.ts",
    documentToken: "app/api/recommendations/next-actions/route.ts",
  },
  {
    path: "app/api/runtime/dingtalk/hourly-sync/route.ts",
    documentToken: "app/api/runtime/dingtalk/hourly-sync/route.ts",
  },
  {
    path: "app/api/runtime/events/meeting-ended/route.ts",
    documentToken: "app/api/runtime/events/meeting-ended/route.ts",
  },
  {
    path: "app/api/runtime/memory/meeting-facts/confirm/route.ts",
    documentToken: "app/api/runtime/memory/meeting-facts/confirm/route.ts",
  },
  {
    path: "app/api/settings/org-admin/support-pack/route.ts",
    documentToken: "app/api/settings/org-admin/support-pack/route.ts",
  },
] as const;

const reviewedApiWorkspaceDefaultLocaleFiles = new Set(
  reviewedApiWorkspaceDefaultLocaleEntries.map((entry) => entry.path),
);

const apiMessageOwnerRules = [
  { owner: "auth", prefix: "app/api/auth/" },
  { owner: "blockers", prefix: "app/api/blockers/" },
  { owner: "briefings", prefix: "app/api/briefings/" },
  { owner: "commitments", prefix: "app/api/commitments/" },
  { owner: "connectors", prefix: "app/api/connectors/" },
  {
    owner: "conversation-capture",
    prefix: "app/api/conversation-capture/",
  },
  { owner: "evolution", prefix: "app/api/evolution/" },
  {
    owner: "tenant-private-extension",
    prefix: `app/api/extensions/${tenantPrivateExtensionKey}/`,
  },
  { owner: "helm-v2-runtime", prefix: "app/api/helm-v2/" },
  { owner: "imports", prefix: "app/api/imports/" },
  {
    owner: "internal-commercialization",
    prefix: "app/api/internal-commercialization/",
  },
  { owner: "llm", prefix: "app/api/llm/" },
  { owner: "memory", prefix: "app/api/memory/" },
  { owner: "opportunities", prefix: "app/api/opportunities/" },
  { owner: "recommendations", prefix: "app/api/recommendations/" },
  { owner: "runtime", prefix: "app/api/runtime/" },
  { owner: "settings", prefix: "app/api/settings/" },
] as const;

const expectedApiMessageOwnerCounts: Record<string, number> = {
  auth: 6,
  blockers: 3,
  briefings: 1,
  commitments: 2,
  connectors: 3,
  "conversation-capture": 5,
  evolution: 14,
  "tenant-private-extension": 2,
  "helm-v2-runtime": 17,
  imports: 5,
  "internal-commercialization": 2,
  llm: 3,
  memory: 10,
  opportunities: 1,
  recommendations: 2,
  runtime: 3,
  settings: 1,
};

const workspaceDefaultLocaleMessagePatterns = [
  /workspace\.defaultLocale/,
  /connector\.workspace\.defaultLocale/,
  /\(session\.workspace as \{ defaultLocale\?: string \| null \}\)\.defaultLocale\s*===\s*"en-US"/,
] as const;

function isSourceFile(entry: string) {
  return (
    sourceExtensions.has(path.extname(entry)) &&
    !entry.endsWith(".test.ts") &&
    !entry.endsWith(".test.tsx")
  );
}

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  const entries = readdirSync(absoluteDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path
      .relative(root, absolutePath)
      .replaceAll(path.sep, "/");
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(relativePath));
      continue;
    }

    if (stats.isFile() && isSourceFile(entry)) {
      files.push(relativePath);
    }
  }

  return files;
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function usesWorkspaceDefaultLocaleForApiMessage(relativePath: string) {
  const source = read(relativePath);
  return workspaceDefaultLocaleMessagePatterns.some((pattern) =>
    pattern.test(source),
  );
}

function resolveApiMessageOwner(relativePath: string) {
  return (
    apiMessageOwnerRules.find((rule) => relativePath.startsWith(rule.prefix))
      ?.owner ?? null
  );
}

describe("api workspace default locale inventory", () => {
  it("keeps every workspace-default API message path reviewed", () => {
    const offenders = listSourceFiles(scanRoot)
      .filter(usesWorkspaceDefaultLocaleForApiMessage)
      .sort();

    expect(offenders).toEqual(
      [...reviewedApiWorkspaceDefaultLocaleFiles].sort(),
    );
  });

  it("keeps reviewed API locale inventory entries pointing at existing route files", () => {
    const sourceFiles = new Set(listSourceFiles(scanRoot));
    const missing = [...reviewedApiWorkspaceDefaultLocaleFiles]
      .filter((file) => !sourceFiles.has(file))
      .sort();

    expect(missing).toEqual([]);
  });

  it("keeps the product inventory document synchronized with the reviewed files", () => {
    const inventoryDocument = read(inventoryDocumentPath);
    const missing = reviewedApiWorkspaceDefaultLocaleEntries
      .filter((entry) => !inventoryDocument.includes(entry.documentToken))
      .map((entry) => entry.documentToken)
      .sort();

    expect(missing).toEqual([]);
  });

  it("keeps every reviewed API message path assigned to a domain owner", () => {
    const missingOwner = [...reviewedApiWorkspaceDefaultLocaleFiles]
      .filter((file) => resolveApiMessageOwner(file) === null)
      .sort();
    const actualCounts = Object.fromEntries(
      Object.keys(expectedApiMessageOwnerCounts).map((owner) => [
        owner,
        [...reviewedApiWorkspaceDefaultLocaleFiles].filter(
          (file) => resolveApiMessageOwner(file) === owner,
        ).length,
      ]),
    );

    expect(missingOwner).toEqual([]);
    expect(actualCounts).toEqual(expectedApiMessageOwnerCounts);
  });

  it("keeps the product inventory document synchronized with message owner keys", () => {
    const inventoryDocument = read(inventoryDocumentPath);
    const missingOwnerKeys = Object.keys(expectedApiMessageOwnerCounts)
      .filter((owner) => !inventoryDocument.includes(`owner:${owner}`))
      .sort();

    expect(missingOwnerKeys).toEqual([]);
  });
});
