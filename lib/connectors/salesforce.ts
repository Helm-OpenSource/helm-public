import {
  ImportJobType,
  ImportSourceStatus,
  ImportSourceType,
  OpportunityType,
} from "@prisma/client";
import { addHours, subDays } from "date-fns";
import { z } from "zod";
import { db } from "@/lib/db";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import {
  runCrmImport,
  buildCrmPreview,
} from "@/lib/imports/crm-orchestrator.service";
import {
  upsertImportSource,
  getImportSourceWithAccessToken,
} from "@/lib/imports/crm-source.service";
import {
  uniqueStrings,
  type CrmDataset,
  type ExternalAssociation,
  type ExternalCompany,
  type ExternalMeeting,
  type ExternalOpportunity,
  type ExternalOwner,
  type ExternalPerson,
  type ExternalTask,
} from "@/lib/imports/crm-types";

export const SALESFORCE_STATE_COOKIE = "helm-salesforce-oauth-state";

type SalesforceTokenResponse = {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  issued_at: string;
  signature: string;
  id?: string;
};

// Salesforce row shapes are validated at the API boundary (see
// salesforceQuery). zod schemas keep the connector honest when Salesforce
// returns unexpected shapes — malformed rows are dropped with a structured
// warning instead of being cast through `as unknown as`.

const sfNullableString = z.union([z.string(), z.null()]).optional();
const sfNullableNumberOrString = z
  .union([z.number(), z.string(), z.null()])
  .optional();

const SalesforceAccountRowSchema = z.object({
  Id: sfNullableString,
  Name: sfNullableString,
  Website: sfNullableString,
  Industry: sfNullableString,
  OwnerId: sfNullableString,
  LastModifiedDate: sfNullableString,
});

const SalesforceContactRowSchema = z.object({
  Id: sfNullableString,
  FirstName: sfNullableString,
  LastName: sfNullableString,
  Email: sfNullableString,
  Phone: sfNullableString,
  Title: sfNullableString,
  AccountId: sfNullableString,
  OwnerId: sfNullableString,
  LastModifiedDate: sfNullableString,
});

const SalesforceOpportunityRowSchema = z.object({
  Id: sfNullableString,
  Name: sfNullableString,
  Amount: sfNullableNumberOrString,
  StageName: sfNullableString,
  CloseDate: sfNullableString,
  AccountId: sfNullableString,
  OwnerId: sfNullableString,
  LastModifiedDate: sfNullableString,
});

const SalesforceEventRowSchema = z.object({
  Id: sfNullableString,
  Subject: sfNullableString,
  StartDateTime: sfNullableString,
  EndDateTime: sfNullableString,
  WhoId: sfNullableString,
  WhatId: sfNullableString,
  OwnerId: sfNullableString,
  Description: sfNullableString,
  LastModifiedDate: sfNullableString,
});

const SalesforceTaskRowSchema = z.object({
  Id: sfNullableString,
  Subject: sfNullableString,
  ActivityDate: sfNullableString,
  WhoId: sfNullableString,
  WhatId: sfNullableString,
  OwnerId: sfNullableString,
  Description: sfNullableString,
  Status: sfNullableString,
  Priority: sfNullableString,
  LastModifiedDate: sfNullableString,
});

function buildSalesforceQueryResponseSchema<T>(rowSchema: z.ZodType<T>) {
  return z.object({
    records: z.array(rowSchema).optional(),
    totalSize: z.number().optional(),
    done: z.boolean().optional(),
  });
}

function parseSalesforceRows<T>(
  rowSchema: z.ZodType<T>,
  raw: unknown,
  rowKind: string,
): T[] {
  const responseSchema = buildSalesforceQueryResponseSchema(rowSchema);
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    process.stderr.write(
      `${JSON.stringify({
        event: "helm.salesforce_response_invalid",
        rowKind,
        issues: parsed.error.issues.slice(0, 5),
        at: new Date().toISOString(),
      })}\n`,
    );
    return [];
  }

  const out: T[] = [];
  for (const candidate of parsed.data.records ?? []) {
    out.push(candidate);
  }
  return out;
}

function readSfString(value: string | null | undefined) {
  return value?.trim() ? value : null;
}

function readSfDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readSfNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getSalesforceConfig() {
  const appUrl = process.env.APP_URL?.trim() || null;
  const redirectUri =
    process.env.SALESFORCE_REDIRECT_URI?.trim() ||
    (appUrl
      ? `${appUrl.replace(/\/$/, "")}/api/connectors/salesforce/callback`
      : null);

  return {
    clientId: process.env.SALESFORCE_CLIENT_ID?.trim() || null,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET?.trim() || null,
    redirectUri,
    authBaseUrl:
      process.env.SALESFORCE_AUTH_BASE_URL?.trim() ||
      "https://login.salesforce.com",
    apiVersion: process.env.SALESFORCE_API_VERSION?.trim() || "v60.0",
  };
}

export function isSalesforceConfigured() {
  const config = getSalesforceConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function buildSalesforceAuthUrl(state: string) {
  const config = getSalesforceConfig();
  if (!config.clientId || !config.redirectUri) {
    throw new Error("Salesforce OAuth 未配置");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });

  return `${config.authBaseUrl}/services/oauth2/authorize?${params.toString()}`;
}

export async function exchangeSalesforceCode(code: string) {
  const config = getSalesforceConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Salesforce OAuth 未配置");
  }

  const response = await fetch(`${config.authBaseUrl}/services/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Salesforce token exchange failed: ${redactProviderErrorBody(await response.text())}`,
    );
  }

  return (await response.json()) as SalesforceTokenResponse;
}

async function salesforceQuery<T>(
  accessToken: string,
  instanceUrl: string,
  soql: string,
) {
  const config = getSalesforceConfig();
  const response = await fetch(
    `${instanceUrl}/services/data/${config.apiVersion}/query?q=${encodeURIComponent(soql)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Salesforce query failed: ${redactProviderErrorBody(await response.text())}`);
  }

  return (await response.json()) as T;
}

export async function upsertSalesforceSourceFromOauth(input: {
  workspaceId: string;
  userId?: string | null;
  token: SalesforceTokenResponse;
}) {
  return upsertImportSource({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    sourceType: ImportSourceType.SALESFORCE,
    sourceName: "Salesforce",
    status: ImportSourceStatus.CONNECTED,
    authMode: "CONNECTED_APP",
    externalAccountId: input.token.id ?? input.token.instance_url,
    externalAccountLabel: input.token.instance_url,
    accessToken: input.token.access_token,
    refreshToken: input.token.refresh_token ?? null,
    configJson: JSON.stringify({
      instanceUrl: input.token.instance_url,
      apiVersion: getSalesforceConfig().apiVersion,
    }),
  });
}

export async function connectMockSalesforceSource(input: {
  workspaceId: string;
  userId?: string | null;
}) {
  return upsertImportSource({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    sourceType: ImportSourceType.SALESFORCE,
    sourceName: "Salesforce",
    status: ImportSourceStatus.CONNECTED,
    authMode: "MOCK",
    externalAccountId: "mock-salesforce-org",
    externalAccountLabel: "Salesforce 示例 Org",
    configJson: JSON.stringify({ mock: true }),
  });
}

function getInstanceUrl(configJson?: string | null) {
  if (!configJson) return null;
  try {
    const parsed = JSON.parse(configJson) as { instanceUrl?: string };
    return parsed.instanceUrl ?? null;
  } catch {
    return null;
  }
}

function buildMockSalesforceDataset(): CrmDataset {
  const now = new Date();
  const greenPeakDate = subDays(now, 3);
  const atlasDate = subDays(now, 1);

  const owners: ExternalOwner[] = [
    { externalId: "sf-owner-1", name: "沈乔", email: "recruiter@example.com" },
    { externalId: "sf-owner-2", name: "李延", email: "founder@example.com" },
  ];

  const companies: ExternalCompany[] = [
    {
      externalId: "sf-account-greenpeak",
      sourceType: ImportSourceType.SALESFORCE,
      name: "GreenPeak Health",
      domain: "greenpeak.demo",
      website: "https://greenpeak.demo",
      industry: "医疗科技",
      ownerExternalId: "sf-owner-1",
      updatedAt: greenPeakDate,
      raw: { id: "sf-account-greenpeak" },
    },
    {
      externalId: "sf-account-atlas",
      sourceType: ImportSourceType.SALESFORCE,
      name: "Atlas AI",
      domain: "atlas.demo",
      website: "https://atlas.demo",
      industry: "AI Infra",
      ownerExternalId: "sf-owner-2",
      updatedAt: atlasDate,
      raw: { id: "sf-account-atlas" },
    },
  ];

  const contacts: ExternalPerson[] = [
    {
      externalId: "sf-contact-aya",
      sourceType: ImportSourceType.SALESFORCE,
      firstName: "Aya",
      lastName: "Nakamura",
      fullName: "Aya Nakamura",
      email: "aya@candidate.demo",
      phone: "13800002222",
      title: "VP Sales Candidate",
      ownerExternalId: "sf-owner-1",
      companyExternalIds: ["sf-account-greenpeak"],
      updatedAt: greenPeakDate,
      raw: { id: "sf-contact-aya" },
    },
    {
      externalId: "sf-contact-lena",
      sourceType: ImportSourceType.SALESFORCE,
      firstName: "Lena",
      lastName: "Xu",
      fullName: "Lena Xu",
      email: "lena@atlas.demo",
      phone: "13800004444",
      title: "Strategy Lead",
      ownerExternalId: "sf-owner-2",
      companyExternalIds: ["sf-account-atlas"],
      updatedAt: atlasDate,
      raw: { id: "sf-contact-lena" },
    },
  ];

  const opportunities: ExternalOpportunity[] = [
    {
      externalId: "sf-opp-greenpeak",
      sourceType: ImportSourceType.SALESFORCE,
      title: "GreenPeak VP Sales 职位委托",
      amount: 50000,
      type: OpportunityType.RECRUITING,
      stageLabel: "Qualification",
      ownerExternalId: "sf-owner-1",
      companyExternalIds: ["sf-account-greenpeak"],
      contactExternalIds: ["sf-contact-aya"],
      updatedAt: greenPeakDate,
      note: "客户希望 48 小时内推进下一步，并提前给候选人评审组信息。",
      raw: { id: "sf-opp-greenpeak" },
    },
    {
      externalId: "sf-opp-atlas",
      sourceType: ImportSourceType.SALESFORCE,
      title: "Atlas AI 联合解决方案合作",
      amount: 120000,
      type: OpportunityType.PARTNERSHIP,
      stageLabel: "Proposal/Price Quote",
      ownerExternalId: "sf-owner-2",
      companyExternalIds: ["sf-account-atlas"],
      contactExternalIds: ["sf-contact-lena"],
      updatedAt: atlasDate,
      note: "Atlas 希望 48 小时内看到合作摘要 和资源边界。",
      raw: { id: "sf-opp-atlas" },
    },
  ];

  const meetings: ExternalMeeting[] = [
    {
      externalId: "sf-event-greenpeak",
      sourceType: ImportSourceType.SALESFORCE,
      title: "GreenPeak 职位推进同步",
      startsAt: greenPeakDate,
      endsAt: addHours(greenPeakDate, 1),
      ownerExternalId: "sf-owner-1",
      companyExternalIds: ["sf-account-greenpeak"],
      contactExternalIds: ["sf-contact-aya"],
      opportunityExternalIds: ["sf-opp-greenpeak"],
      noteBody:
        "Aya 希望提前收到评审组信息，客户希望 48 小时内推进下一步。当前卡点是 Aya 需要更稳定的面试预期。",
      updatedAt: greenPeakDate,
      raw: { id: "sf-event-greenpeak" },
    },
  ];

  const tasks: ExternalTask[] = [
    {
      externalId: "sf-task-atlas-brief",
      sourceType: ImportSourceType.SALESFORCE,
      title: "发送 Atlas 合作摘要",
      body: "48 小时内发送合作摘要，并确认双方资源边界。",
      dueDate: addHours(atlasDate, 36),
      ownerExternalId: "sf-owner-2",
      companyExternalIds: ["sf-account-atlas"],
      contactExternalIds: ["sf-contact-lena"],
      opportunityExternalIds: ["sf-opp-atlas"],
      completed: false,
      priority: "HIGH",
      raw: { id: "sf-task-atlas-brief", priority: "High" },
    },
  ];

  const associations: ExternalAssociation[] = [
    {
      fromType: "CONTACT",
      fromId: "sf-contact-aya",
      toType: "COMPANY",
      toId: "sf-account-greenpeak",
    },
    {
      fromType: "CONTACT",
      fromId: "sf-contact-lena",
      toType: "COMPANY",
      toId: "sf-account-atlas",
    },
    {
      fromType: "OPPORTUNITY",
      fromId: "sf-opp-greenpeak",
      toType: "COMPANY",
      toId: "sf-account-greenpeak",
    },
    {
      fromType: "OPPORTUNITY",
      fromId: "sf-opp-greenpeak",
      toType: "CONTACT",
      toId: "sf-contact-aya",
    },
    {
      fromType: "OPPORTUNITY",
      fromId: "sf-opp-atlas",
      toType: "COMPANY",
      toId: "sf-account-atlas",
    },
    {
      fromType: "OPPORTUNITY",
      fromId: "sf-opp-atlas",
      toType: "CONTACT",
      toId: "sf-contact-lena",
    },
  ];

  return {
    sourceType: ImportSourceType.SALESFORCE,
    accountId: "mock-salesforce-org",
    accountLabel: "Salesforce 示例 Org",
    owners,
    contacts,
    companies,
    opportunities,
    meetings,
    notes: [],
    tasks,
    associations,
    usedMock: true,
  };
}

async function fetchSalesforceDataset(
  sourceId: string,
  previewOnly = false,
  incremental = false,
): Promise<CrmDataset> {
  const { source, accessToken } =
    await getImportSourceWithAccessToken(sourceId);
  const instanceUrl = getInstanceUrl(source.configJson);

  if (!accessToken || !instanceUrl || source.authMode === "MOCK") {
    return buildMockSalesforceDataset();
  }

  const limit = previewOnly ? 10 : 100;
  const updatedFilter =
    incremental && source.lastSyncedAt
      ? ` WHERE LastModifiedDate > '${source.lastSyncedAt.toISOString()}'`
      : "";

  const [accountsRaw, contactsRaw, opportunitiesRaw, eventsRaw, tasksRaw] =
    await Promise.all([
      salesforceQuery<unknown>(
        accessToken,
        instanceUrl,
        `SELECT Id, Name, Website, Industry, OwnerId, LastModifiedDate FROM Account${updatedFilter} ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
      ),
      salesforceQuery<unknown>(
        accessToken,
        instanceUrl,
        `SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId, OwnerId, LastModifiedDate FROM Contact${updatedFilter} ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
      ),
      salesforceQuery<unknown>(
        accessToken,
        instanceUrl,
        `SELECT Id, Name, Amount, StageName, CloseDate, AccountId, OwnerId, LastModifiedDate FROM Opportunity${updatedFilter} ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
      ),
      salesforceQuery<unknown>(
        accessToken,
        instanceUrl,
        `SELECT Id, Subject, StartDateTime, EndDateTime, WhoId, WhatId, OwnerId, Description, LastModifiedDate FROM Event${updatedFilter} ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
      ),
      salesforceQuery<unknown>(
        accessToken,
        instanceUrl,
        `SELECT Id, Subject, ActivityDate, WhoId, WhatId, OwnerId, Description, Status, Priority, LastModifiedDate FROM Task${updatedFilter} ORDER BY LastModifiedDate DESC LIMIT ${limit}`,
      ),
    ]);

  const accountRows = parseSalesforceRows(SalesforceAccountRowSchema, accountsRaw, "account");
  const contactRows = parseSalesforceRows(SalesforceContactRowSchema, contactsRaw, "contact");
  const opportunityRows = parseSalesforceRows(SalesforceOpportunityRowSchema, opportunitiesRaw, "opportunity");
  const eventRows = parseSalesforceRows(SalesforceEventRowSchema, eventsRaw, "event");
  const taskRows = parseSalesforceRows(SalesforceTaskRowSchema, tasksRaw, "task");

  const ownerIds = uniqueStrings([
    ...accountRows.map((item) => item.OwnerId ?? null),
    ...contactRows.map((item) => item.OwnerId ?? null),
    ...opportunityRows.map((item) => item.OwnerId ?? null),
    ...eventRows.map((item) => item.OwnerId ?? null),
    ...taskRows.map((item) => item.OwnerId ?? null),
  ]);

  const owners: ExternalOwner[] = ownerIds.map((id) => ({
    externalId: id,
    name: id,
  }));

  const toRaw = (row: object): Record<string, unknown> =>
    row as Record<string, unknown>;

  const companies: ExternalCompany[] = accountRows.map((item) => ({
    externalId: item.Id ?? "",
    sourceType: ImportSourceType.SALESFORCE,
    name: readSfString(item.Name) ?? `Account ${item.Id ?? "unknown"}`,
    domain: readSfString(item.Website),
    website: readSfString(item.Website),
    industry: readSfString(item.Industry),
    ownerExternalId: readSfString(item.OwnerId),
    updatedAt: readSfDate(item.LastModifiedDate),
    raw: toRaw(item),
  }));

  const contacts: ExternalPerson[] = contactRows.map((item) => ({
    externalId: item.Id ?? "",
    sourceType: ImportSourceType.SALESFORCE,
    firstName: readSfString(item.FirstName),
    lastName: readSfString(item.LastName),
    fullName:
      [readSfString(item.FirstName), readSfString(item.LastName)]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      readSfString(item.Email) ||
      item.Id ||
      "Salesforce Contact",
    email: readSfString(item.Email),
    phone: readSfString(item.Phone),
    title: readSfString(item.Title),
    ownerExternalId: readSfString(item.OwnerId),
    companyExternalIds: item.AccountId ? [item.AccountId] : [],
    updatedAt: readSfDate(item.LastModifiedDate),
    raw: toRaw(item),
  }));

  const opportunities: ExternalOpportunity[] = opportunityRows.map((item) => ({
    externalId: item.Id ?? "",
    sourceType: ImportSourceType.SALESFORCE,
    title: readSfString(item.Name) ?? item.Id ?? "Salesforce Opportunity",
    amount: readSfNumber(item.Amount),
    type: OpportunityType.CLIENT,
    stageLabel: readSfString(item.StageName),
    ownerExternalId: readSfString(item.OwnerId),
    companyExternalIds: item.AccountId ? [item.AccountId] : [],
    contactExternalIds: [],
    dueDate: readSfDate(item.CloseDate),
    updatedAt: readSfDate(item.LastModifiedDate),
    raw: toRaw(item),
  }));

  const meetings: ExternalMeeting[] = eventRows.map((item) => ({
    externalId: item.Id ?? "",
    sourceType: ImportSourceType.SALESFORCE,
    title: readSfString(item.Subject) ?? `Event ${item.Id ?? "unknown"}`,
    startsAt: readSfDate(item.StartDateTime) ?? new Date(),
    endsAt: readSfDate(item.EndDateTime) ?? addHours(new Date(), 1),
    ownerExternalId: readSfString(item.OwnerId),
    companyExternalIds: item.WhatId ? [item.WhatId] : [],
    contactExternalIds: item.WhoId ? [item.WhoId] : [],
    opportunityExternalIds: item.WhatId ? [item.WhatId] : [],
    noteBody: readSfString(item.Description),
    updatedAt: readSfDate(item.LastModifiedDate),
    raw: toRaw(item),
  }));

  const tasks: ExternalTask[] = taskRows.map((item) => ({
    externalId: item.Id ?? "",
    sourceType: ImportSourceType.SALESFORCE,
    title: readSfString(item.Subject) ?? `Task ${item.Id ?? "unknown"}`,
    body: readSfString(item.Description),
    dueDate: readSfDate(item.ActivityDate),
    ownerExternalId: readSfString(item.OwnerId),
    companyExternalIds: item.WhatId ? [item.WhatId] : [],
    contactExternalIds: item.WhoId ? [item.WhoId] : [],
    opportunityExternalIds: item.WhatId ? [item.WhatId] : [],
    completed: String(item.Status ?? "")
      .toLowerCase()
      .includes("complete"),
    priority: String(item.Priority ?? "")
      .toLowerCase()
      .includes("high")
      ? "HIGH"
      : "MEDIUM",
    raw: toRaw(item),
  }));

  const associations: ExternalAssociation[] = [
    ...contacts.flatMap((contact) =>
      (contact.companyExternalIds ?? []).map((companyId) => ({
        fromType: "CONTACT",
        fromId: contact.externalId,
        toType: "COMPANY",
        toId: companyId,
      })),
    ),
    ...opportunities.flatMap((opportunity) =>
      (opportunity.companyExternalIds ?? []).map((companyId) => ({
        fromType: "OPPORTUNITY",
        fromId: opportunity.externalId,
        toType: "COMPANY",
        toId: companyId,
      })),
    ),
  ];

  return {
    sourceType: ImportSourceType.SALESFORCE,
    accountId: source.externalAccountId,
    accountLabel: source.externalAccountLabel ?? "Salesforce Org",
    owners,
    contacts,
    companies,
    opportunities,
    meetings,
    notes: [],
    tasks,
    associations,
    usedMock: false,
  };
}

export async function previewSalesforceImport(sourceId: string) {
  return buildCrmPreview(await fetchSalesforceDataset(sourceId, true, false));
}

export async function runSalesforceImport(input: {
  workspaceId: string;
  userId?: string | null;
  sourceId: string;
  incremental?: boolean;
}) {
  const source = await db.importSource.findUnique({
    where: { id: input.sourceId },
  });
  if (!source) {
    throw new Error("Salesforce 导入来源不存在");
  }
  const dataset = await fetchSalesforceDataset(
    input.sourceId,
    false,
    Boolean(input.incremental),
  );
  return runCrmImport({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    source,
    dataset,
    jobType: input.incremental
      ? ImportJobType.INCREMENTAL_SYNC
      : ImportJobType.INITIAL_IMPORT,
  });
}
