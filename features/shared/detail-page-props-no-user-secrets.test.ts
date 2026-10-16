import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// Regression guard: the contact, company and meeting detail pages hand their
// loader output to client components, so it is serialised into the RSC
// payload. No user row in it may carry password, verification or login state.
//
// The loaders run against a fake Prisma client generated from the schema
// (Prisma.dmmf): every scalar of every selected model is filled in, and every
// relation that is included with `true` comes back as a full row. So a nested
// `owner: true` on a User relation would put `passwordHash` into the output,
// and this test would fail.
//
// 回归守卫：联系人、公司、会议详情页的 loader 输出会序列化给客户端组件，其中任何
// 用户记录都不能带密码、验证或登录状态。fake Prisma 按 schema 填满所有字段，
// 只要有 `owner: true` 这类整行 include，passwordHash 就会出现，测试即失败。

const SENSITIVE_KEYS = [
  "passwordHash",
  "passwordSetAt",
  "emailVerifiedAt",
  "phoneVerifiedAt",
  "lastLoginAt",
  "sessionKeyHash",
  "tokenHash",
  "codeHash",
] as const;

type DmmfField = (typeof Prisma.dmmf.datamodel.models)[number]["fields"][number];
type FindArgs = {
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
} | undefined;

const fakeDb = vi.hoisted(() => {
  // Filled in after imports resolve (Prisma is not available inside hoisted code).
  return { current: null as unknown };
});

vi.mock("@/lib/db", () => ({
  get db() {
    return fakeDb.current;
  },
}));
vi.mock("@/lib/auth/session", () => {
  const workspace = {
    id: "workspace-1",
    name: "Workspace",
    defaultLocale: "zh-CN",
    configuration: null,
    profileType: null,
    focusAreas: null,
  };
  const user = { id: "user-1", name: "Owner", email: "owner@example.com" };
  return {
    getCurrentWorkspace: async () => workspace,
    requireCurrentUser: async () => user,
    getCurrentWorkspaceSession: async () => ({
      workspace,
      user,
      membership: { role: "OWNER", workspaceId: workspace.id, userId: user.id },
    }),
  };
});
vi.mock("@/lib/i18n/request-locale.server", () => ({
  getRequestUiLocaleCandidate: async () => null,
  getDeploymentProfileDefaultLocaleCandidate: () => null,
  resolveWorkspaceUiLocaleForRequest: async () => "zh-CN",
}));
vi.mock("@/lib/analytics/session-events", () => ({
  logPageViewEvent: async () => undefined,
  logCurrentWorkspaceEvent: async () => undefined,
}));
vi.mock("@/lib/recommendations/recommendation.service", () => ({
  generateRecommendationsForObject: async () => [],
}));
vi.mock("@/lib/memory/briefing.service", () => ({
  generateContactBriefingSnapshot: async () => null,
  generateCompanyBriefingSnapshot: async () => null,
  generateMeetingBriefingSnapshot: async () => null,
}));
vi.mock("@/lib/memory/meeting-memory-pipeline.service", () => ({
  processMeetingMemory: async () => undefined,
}));
vi.mock("@/lib/operating-system/first-loop-query", () => ({
  getWorkspaceFirstLoopModel: async () => null,
}));
vi.mock("@/lib/helm-v2/meeting-action-pack-runtime", () => ({
  getMeetingRuntimeSummary: async () => null,
  ingestMeetingEndedRuntime: async () => undefined,
}));
vi.mock("@/lib/helm-v2/opportunity-judge-runtime", () => ({
  getMeetingOpportunityJudgeRuntimeSummary: async () => null,
  runOpportunityJudgeRuntime: async () => undefined,
}));
vi.mock("@/lib/helm-v2/draft-comms-handoff-runtime", () => ({
  getMeetingDraftCommsRuntimeSummary: async () => null,
  runDraftCommsHandoffRuntime: async () => undefined,
}));
vi.mock("@/lib/helm-v2/human-action-execution-runtime", () => ({
  getMeetingHumanActionExecutionSummary: async () => null,
  syncMeetingHumanActionExecutionRuntime: async () => undefined,
}));
vi.mock("@/lib/helm-v2/official-system-integration-runtime", () => ({
  getMeetingOfficialWriteRuntimeSummary: async () => null,
  syncMeetingOfficialFollowThroughRuntime: async () => undefined,
  syncMeetingLimitedAutoIntents: async () => undefined,
  syncMeetingOfficialWriteIntents: async () => undefined,
}));
vi.mock("@/lib/helm-v2/connector-ingestion-retrieval-runtime", () => ({
  getMeetingConnectorIngestionRetrievalSummary: async () => null,
  syncMeetingConnectorIngestionRetrievalRuntime: async () => undefined,
}));

import { loadCompanyDetailPageData } from "@/features/companies/page-loader";
import { loadContactDetailPageData } from "@/features/contacts/page-loader";
import { loadMeetingDetailPageData } from "@/features/meetings/page-loader";

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);
const firstEnumValue = new Map(
  Prisma.dmmf.datamodel.enums.map((item) => [item.name, item.values[0]?.name]),
);

function scalarValue(modelName: string, field: DmmfField): unknown {
  switch (field.type) {
    case "String":
      if (field.name === "id") return `${modelName}-id`;
      // Foreign keys line up with the related row's id (userId → "User-id"),
      // so joins done in code, like memberships → users, find their rows.
      if (field.name.endsWith("Id")) {
        const related = field.name.slice(0, -2);
        return `${related.charAt(0).toUpperCase()}${related.slice(1)}-id`;
      }
      return `${field.name}-value`;
    case "Int":
    case "Float":
    case "Decimal":
    case "BigInt":
      return 1;
    case "Boolean":
      return false;
    case "DateTime":
      return new Date("2026-10-15T00:00:00.000Z");
    case "Json":
    case "Bytes":
      return null;
    default:
      return firstEnumValue.get(field.type) ?? null;
  }
}

function buildRow(modelName: string, args: FindArgs): Record<string, unknown> {
  const model = models.get(modelName);
  if (!model) throw new Error(`unknown model ${modelName}`);
  const shape = args?.select ?? args?.include;
  const row: Record<string, unknown> = {};

  for (const field of model.fields) {
    if (field.kind === "object") {
      const spec = shape?.[field.name];
      if (!spec) continue;
      const child = buildRow(field.type, spec === true ? undefined : (spec as FindArgs));
      row[field.name] = field.isList ? [child] : child;
      continue;
    }
    if (args?.select && !args.select[field.name]) continue;
    row[field.name] = scalarValue(modelName, field);
  }

  const countSpec = shape?._count as { select?: Record<string, unknown> } | undefined;
  if (countSpec) {
    row._count = Object.fromEntries(
      Object.keys(countSpec.select ?? {}).map((key) => [key, 1]),
    );
  }
  return row;
}

function delegateFor(modelName: string) {
  return {
    findFirst: async (args?: FindArgs) => buildRow(modelName, args),
    findUnique: async (args?: FindArgs) => buildRow(modelName, args),
    findMany: async (args?: FindArgs) => [buildRow(modelName, args)],
    count: async () => 1,
    create: async (args?: FindArgs) => buildRow(modelName, args),
    update: async (args?: FindArgs) => buildRow(modelName, args),
    upsert: async (args?: FindArgs) => buildRow(modelName, args),
  };
}

const delegateNames = new Map(
  [...models.keys()].map((name) => [name.charAt(0).toLowerCase() + name.slice(1), name]),
);

fakeDb.current = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "$transaction") {
        return async (input: unknown) =>
          Array.isArray(input) ? Promise.all(input) : (input as (db: unknown) => unknown)(fakeDb.current);
      }
      const modelName = typeof prop === "string" ? delegateNames.get(prop) : undefined;
      return modelName ? delegateFor(modelName) : undefined;
    },
  },
);

function expectNoUserSecrets(label: string, value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized.length, `${label} produced no output`).toBeGreaterThan(100);
  for (const key of SENSITIVE_KEYS) {
    expect(serialized, `${label} serialises ${key}`).not.toContain(`"${key}"`);
  }
}

describe("detail page props carry no user secrets", () => {
  it("would expose a full User row included with true (positive control)", () => {
    const row = buildRow("Meeting", { include: { owner: true } });
    expect(JSON.stringify(row)).toContain('"passwordHash"');
    expect(JSON.stringify(buildRow("Meeting", { include: { owner: { select: { id: true, name: true } } } }))).not.toContain(
      '"passwordHash"',
    );
  });

  it("contact detail loader output", async () => {
    const detail = await loadContactDetailPageData("contact-1");
    expectNoUserSecrets("contact detail", detail);
    expect(detail?.contact.owner).toEqual({
      id: "User-id",
      name: "name-value",
      email: "email-value",
    });
  });

  it("company detail loader output", async () => {
    const detail = await loadCompanyDetailPageData("company-1");
    expectNoUserSecrets("company detail", detail);
    expect(detail?.company.opportunities[0]?.owner).toEqual({
      id: "User-id",
      name: "name-value",
      email: "email-value",
    });
  });

  it("meeting detail loader output, including the owner picker memberships", async () => {
    const detail = await loadMeetingDetailPageData("meeting-1");
    expectNoUserSecrets("meeting detail", detail);
    expect(detail?.memberships[0]).toEqual({
      user: { id: "User-id", name: "name-value", email: "email-value" },
    });
  });
});
