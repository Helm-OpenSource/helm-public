import { ImportJobType, ImportSourceStatus, ImportSourceType, OpportunityType } from "@prisma/client";
import { subDays } from "date-fns";
import { db } from "@/lib/db";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { runCrmImport, buildCrmPreview } from "@/lib/imports/crm-orchestrator.service";
import { upsertImportSource, getImportSourceWithAccessToken } from "@/lib/imports/crm-source.service";
import {
  uniqueStrings,
  type CrmDataset,
  type ExternalAssociation,
  type ExternalCompany,
  type ExternalNote,
  type ExternalOpportunity,
  type ExternalOwner,
  type ExternalPerson,
} from "@/lib/imports/crm-types";

const HUBSPOT_SCOPE = [
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "crm.objects.notes.read",
  "crm.schemas.associations.read",
  "oauth",
].join(" ");

export const HUBSPOT_STATE_COOKIE = "helm-hubspot-oauth-state";

type HubSpotTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  hub_id?: number;
};

type HubSpotOwnerRow = {
  id?: string | number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type HubSpotObjectRow = {
  id?: string | number;
  properties?: Record<string, unknown> | null;
  associations?: Record<string, unknown> | null;
};

function asHubSpotProperties(value: Record<string, unknown> | null | undefined) {
  return (value ?? {}) as Record<string, unknown>;
}

function asHubSpotAssociations(value: Record<string, unknown> | null | undefined) {
  return (value ?? undefined) as Record<string, unknown> | undefined;
}

function readString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function readDate(value: unknown) {
  const normalized = readString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getHubSpotConfig() {
  const appUrl = process.env.APP_URL?.trim() || null;
  const redirectUri =
    process.env.HUBSPOT_REDIRECT_URI?.trim() ||
    (appUrl ? `${appUrl.replace(/\/$/, "")}/api/connectors/hubspot/callback` : null);

  return {
    clientId: process.env.HUBSPOT_CLIENT_ID?.trim() || null,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET?.trim() || null,
    redirectUri,
  };
}

export function isHubSpotConfigured() {
  const config = getHubSpotConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function buildHubSpotAuthUrl(state: string) {
  const config = getHubSpotConfig();
  if (!config.clientId || !config.redirectUri) {
    throw new Error("HubSpot OAuth 未配置");
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: HUBSPOT_SCOPE,
    state,
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeHubSpotCode(code: string) {
  const config = getHubSpotConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("HubSpot OAuth 未配置");
  }

  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
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
    throw new Error(`HubSpot token exchange failed: ${redactProviderErrorBody(await response.text())}`);
  }

  return (await response.json()) as HubSpotTokenResponse;
}

async function refreshHubSpotToken(refreshToken: string) {
  const config = getHubSpotConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("HubSpot OAuth 未配置");
  }

  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot token refresh failed: ${redactProviderErrorBody(await response.text())}`);
  }

  return (await response.json()) as HubSpotTokenResponse;
}

async function hubspotFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`https://api.hubapi.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HubSpot API failed: ${redactProviderErrorBody(await response.text())}`);
  }

  return (await response.json()) as T;
}

async function getValidHubSpotAccessToken(sourceId: string) {
  const { source, accessToken, refreshToken } = await getImportSourceWithAccessToken(sourceId);

  if (accessToken && (!source.tokenExpiresAt || source.tokenExpiresAt.getTime() > Date.now() + 60_000)) {
    return { source, accessToken };
  }

  if (!refreshToken) {
    return { source, accessToken: null };
  }

  const refreshed = await refreshHubSpotToken(refreshToken);
  const updated = await db.importSource.update({
    where: { id: source.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? source.refreshToken,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });

  return {
    source: updated,
    accessToken: refreshed.access_token,
  };
}

export async function upsertHubSpotSourceFromOauth(input: {
  workspaceId: string;
  userId?: string | null;
  token: HubSpotTokenResponse;
}) {
  const accountLabel = input.token.hub_id ? `HubSpot Portal ${input.token.hub_id}` : "HubSpot 工作区";
  return upsertImportSource({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    sourceType: ImportSourceType.HUBSPOT,
    sourceName: "HubSpot",
    status: ImportSourceStatus.CONNECTED,
    authMode: "OAUTH",
    externalAccountId: input.token.hub_id ? String(input.token.hub_id) : null,
    externalAccountLabel: accountLabel,
    accessToken: input.token.access_token,
    refreshToken: input.token.refresh_token ?? null,
    tokenExpiresAt: new Date(Date.now() + input.token.expires_in * 1000),
    configJson: JSON.stringify({ scopes: HUBSPOT_SCOPE }),
  });
}

export async function connectMockHubSpotSource(input: {
  workspaceId: string;
  userId?: string | null;
}) {
  return upsertImportSource({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    sourceType: ImportSourceType.HUBSPOT,
    sourceName: "HubSpot",
    status: ImportSourceStatus.CONNECTED,
    authMode: "MOCK",
    externalAccountId: "mock-hubspot-portal",
    externalAccountLabel: "HubSpot 示例工作区",
    configJson: JSON.stringify({ mock: true }),
  });
}

function mapDealType(_deal: HubSpotObjectRow) {
  void _deal;
  return OpportunityType.CLIENT;
}

function extractHubspotAssociations(sourceType: string, externalId: string, associations: Record<string, unknown> | undefined) {
  const result: ExternalAssociation[] = [];
  if (!associations) return result;

  for (const [targetType, value] of Object.entries(associations)) {
    const items = Array.isArray((value as { results?: unknown[] })?.results)
      ? ((value as { results?: Array<{ id?: string }> }).results ?? [])
      : Array.isArray(value)
        ? (value as Array<{ id?: string }>)
        : [];

    for (const item of items) {
      if (!item?.id) continue;
      result.push({
        fromType: sourceType,
        fromId: externalId,
        toType: targetType.toUpperCase().replace(/IES$/, "Y").replace(/S$/, ""),
        toId: item.id,
      });
    }
  }

  return result;
}

function buildMockHubSpotDataset(): CrmDataset {
  const now = new Date();
  const acmeDate = subDays(now, 2);
  const deltaDate = subDays(now, 4);

  const owners: ExternalOwner[] = [
    { externalId: "hub-owner-1", name: "周玥", email: "saleslead@example.com" },
    { externalId: "hub-owner-2", name: "李延", email: "founder@example.com" },
  ];

  const companies: ExternalCompany[] = [
    {
      externalId: "hub-company-acme",
      sourceType: ImportSourceType.HUBSPOT,
      name: "Acme Robotics",
      domain: "acme.demo",
      website: "https://acme.demo",
      industry: "工业自动化",
      ownerExternalId: "hub-owner-1",
      updatedAt: acmeDate,
      raw: { id: "hub-company-acme" },
    },
    {
      externalId: "hub-company-delta",
      sourceType: ImportSourceType.HUBSPOT,
      name: "Delta Capital",
      domain: "delta.demo",
      website: "https://delta.demo",
      industry: "投资",
      ownerExternalId: "hub-owner-2",
      updatedAt: deltaDate,
      raw: { id: "hub-company-delta" },
    },
  ];

  const contacts: ExternalPerson[] = [
    {
      externalId: "hub-contact-vivian",
      sourceType: ImportSourceType.HUBSPOT,
      firstName: "Vivian",
      lastName: "Chen",
      fullName: "Vivian Chen",
      email: "vivian@acme.demo",
      phone: "13800001111",
      title: "CFO",
      ownerExternalId: "hub-owner-1",
      companyExternalIds: ["hub-company-acme"],
      updatedAt: acmeDate,
      raw: { id: "hub-contact-vivian" },
    },
    {
      externalId: "hub-contact-mason",
      sourceType: ImportSourceType.HUBSPOT,
      firstName: "Mason",
      lastName: "Liu",
      fullName: "Mason Liu",
      email: "mason@delta.demo",
      phone: "13800003333",
      title: "Partner",
      ownerExternalId: "hub-owner-2",
      companyExternalIds: ["hub-company-delta"],
      updatedAt: deltaDate,
      raw: { id: "hub-contact-mason" },
    },
  ];

  const opportunities: ExternalOpportunity[] = [
    {
      externalId: "hub-deal-acme",
      sourceType: ImportSourceType.HUBSPOT,
      title: "Acme 年度经营动作控制台试点",
      amount: 180000,
      type: OpportunityType.CLIENT,
      stageLabel: "presentationscheduled",
      ownerExternalId: "hub-owner-1",
      companyExternalIds: ["hub-company-acme"],
      contactExternalIds: ["hub-contact-vivian"],
      updatedAt: acmeDate,
      note: "采购委员会希望先看分阶段 ROI 与付款拆分方案。",
      raw: { id: "hub-deal-acme" },
    },
    {
      externalId: "hub-deal-delta",
      sourceType: ImportSourceType.HUBSPOT,
      title: "Delta Capital 闭门沙龙共办",
      amount: 60000,
      type: OpportunityType.PARTNERSHIP,
      stageLabel: "appointmentscheduled",
      ownerExternalId: "hub-owner-2",
      companyExternalIds: ["hub-company-delta"],
      contactExternalIds: ["hub-contact-mason"],
      updatedAt: deltaDate,
      note: "对方在等我们确认嘉宾标准与共办节奏。",
      raw: { id: "hub-deal-delta" },
    },
  ];

  const notes: ExternalNote[] = [
    {
      externalId: "hub-note-acme-1",
      sourceType: ImportSourceType.HUBSPOT,
      title: "Acme 采购委员会备注",
      body: "客户更关心付款周期，希望下周三前收到结构化方案初稿。Daniel 愿意内部推动，但付款节奏还没拍板。",
      occurredAt: acmeDate,
      ownerExternalId: "hub-owner-1",
      companyExternalIds: ["hub-company-acme"],
      contactExternalIds: ["hub-contact-vivian"],
      opportunityExternalIds: ["hub-deal-acme"],
      raw: { id: "hub-note-acme-1" },
    },
    {
      externalId: "hub-note-delta-1",
      sourceType: ImportSourceType.HUBSPOT,
      title: "Delta follow-up note",
      body: "Mason 认可方向，但还在等我们给一版更精简的闭门沙龙大纲。两天内不推进，这个合作热度会下降。",
      occurredAt: deltaDate,
      ownerExternalId: "hub-owner-2",
      companyExternalIds: ["hub-company-delta"],
      contactExternalIds: ["hub-contact-mason"],
      opportunityExternalIds: ["hub-deal-delta"],
      raw: { id: "hub-note-delta-1" },
    },
  ];

  const associations: ExternalAssociation[] = [
    { fromType: "CONTACT", fromId: "hub-contact-vivian", toType: "COMPANY", toId: "hub-company-acme" },
    { fromType: "CONTACT", fromId: "hub-contact-mason", toType: "COMPANY", toId: "hub-company-delta" },
    { fromType: "OPPORTUNITY", fromId: "hub-deal-acme", toType: "COMPANY", toId: "hub-company-acme" },
    { fromType: "OPPORTUNITY", fromId: "hub-deal-acme", toType: "CONTACT", toId: "hub-contact-vivian" },
    { fromType: "OPPORTUNITY", fromId: "hub-deal-delta", toType: "COMPANY", toId: "hub-company-delta" },
    { fromType: "OPPORTUNITY", fromId: "hub-deal-delta", toType: "CONTACT", toId: "hub-contact-mason" },
  ];

  return {
    sourceType: ImportSourceType.HUBSPOT,
    accountId: "mock-hubspot-portal",
    accountLabel: "HubSpot 示例工作区",
    owners,
    contacts,
    companies,
    opportunities,
    meetings: [],
    notes,
    tasks: [],
    associations,
    usedMock: true,
  };
}

async function fetchHubSpotDataset(sourceId: string, previewOnly = false, incremental = false): Promise<CrmDataset> {
  const { source, accessToken } = await getValidHubSpotAccessToken(sourceId);

  if (!accessToken || source.authMode === "MOCK") {
    return buildMockHubSpotDataset();
  }

  const updatedAfter = incremental && source.lastSyncedAt ? source.lastSyncedAt.toISOString() : null;
  const limit = previewOnly ? 10 : 100;

  const [
    contactsResponse,
    companiesResponse,
    dealsResponse,
    notesResponse,
    ownersResponse,
  ] = await Promise.all([
    hubspotFetch<{ results?: HubSpotObjectRow[] }>(
      accessToken,
      `/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,phone,jobtitle,hubspot_owner_id,lastmodifieddate&associations=companies`,
    ),
    hubspotFetch<{ results?: HubSpotObjectRow[] }>(
      accessToken,
      `/crm/v3/objects/companies?limit=${limit}&properties=name,domain,website,industry,hubspot_owner_id,lastmodifieddate&associations=contacts`,
    ),
    hubspotFetch<{ results?: HubSpotObjectRow[] }>(
      accessToken,
      `/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,pipeline,hubspot_owner_id,closedate,lastmodifieddate&associations=contacts,companies`,
    ),
    hubspotFetch<{ results?: HubSpotObjectRow[] }>(
      accessToken,
      `/crm/v3/objects/notes?limit=${limit}&properties=hs_timestamp,hs_note_body,hubspot_owner_id,hs_lastmodifieddate&associations=contacts,companies,deals`,
    ),
    hubspotFetch<{ results?: HubSpotOwnerRow[] }>(
      accessToken,
      `/crm/v3/owners/?limit=${limit}`,
    ),
  ]);

  const owners: ExternalOwner[] = (ownersResponse.results ?? []).map((owner) => ({
    externalId: String(owner.id ?? ""),
    name:
      `${readString(owner.firstName) ?? ""} ${readString(owner.lastName) ?? ""}`.trim() ||
      readString(owner.email) ||
      "HubSpot Owner",
    email: readString(owner.email),
  }));

  const contacts: ExternalPerson[] = [];
  const companies: ExternalCompany[] = [];
  const opportunities: ExternalOpportunity[] = [];
  const notes: ExternalNote[] = [];
  const associations: ExternalAssociation[] = [];

  for (const item of contactsResponse.results ?? []) {
    const properties = asHubSpotProperties(item.properties);
    const associationsData = asHubSpotAssociations(item.associations);
    const updatedAt = readDate(properties.lastmodifieddate);
    if (updatedAfter && updatedAt && updatedAt.toISOString() <= updatedAfter) continue;
    // Skip rows with no HubSpot id: a coerced "" externalId would collide
    // across all such rows and overwrite them on re-import.
    if (!item.id) continue;
    const externalId = String(item.id);
    contacts.push({
      externalId,
      sourceType: ImportSourceType.HUBSPOT,
      firstName: readString(properties.firstname),
      lastName: readString(properties.lastname),
      fullName:
        [readString(properties.firstname), readString(properties.lastname)].filter(Boolean).join(" ").trim() ||
        readString(properties.email) ||
        `HubSpot Contact ${externalId}`,
      email: readString(properties.email),
      phone: readString(properties.phone),
      title: readString(properties.jobtitle),
      ownerExternalId: readString(properties.hubspot_owner_id),
      companyExternalIds: extractHubspotAssociations("CONTACT", externalId, associationsData)
        .filter((association) => association.toType === "COMPANY")
        .map((association) => association.toId),
      updatedAt,
      raw: item as Record<string, unknown>,
    });
    associations.push(...extractHubspotAssociations("CONTACT", externalId, associationsData));
  }

  for (const item of companiesResponse.results ?? []) {
    const properties = asHubSpotProperties(item.properties);
    const associationsData = asHubSpotAssociations(item.associations);
    const updatedAt = readDate(properties.lastmodifieddate);
    if (updatedAfter && updatedAt && updatedAt.toISOString() <= updatedAfter) continue;
    // Skip rows with no HubSpot id: a coerced "" externalId would collide
    // across all such rows and overwrite them on re-import.
    if (!item.id) continue;
    const externalId = String(item.id);
    companies.push({
      externalId,
      sourceType: ImportSourceType.HUBSPOT,
      name: readString(properties.name) ?? `HubSpot Company ${externalId}`,
      domain: readString(properties.domain),
      website: readString(properties.website),
      industry: readString(properties.industry),
      ownerExternalId: readString(properties.hubspot_owner_id),
      contactExternalIds: extractHubspotAssociations("COMPANY", externalId, associationsData)
        .filter((association) => association.toType === "CONTACT")
        .map((association) => association.toId),
      updatedAt,
      raw: item as Record<string, unknown>,
    });
    associations.push(...extractHubspotAssociations("COMPANY", externalId, associationsData));
  }

  for (const item of dealsResponse.results ?? []) {
    const properties = asHubSpotProperties(item.properties);
    const associationsData = asHubSpotAssociations(item.associations);
    const updatedAt = readDate(properties.lastmodifieddate);
    if (updatedAfter && updatedAt && updatedAt.toISOString() <= updatedAfter) continue;
    // Skip rows with no HubSpot id: a coerced "" externalId would collide
    // across all such rows and overwrite them on re-import.
    if (!item.id) continue;
    const externalId = String(item.id);
    opportunities.push({
      externalId,
      sourceType: ImportSourceType.HUBSPOT,
      title: readString(properties.dealname) ?? `HubSpot Deal ${externalId}`,
      amount: readNumber(properties.amount),
      type: mapDealType(item),
      stageLabel: readString(properties.dealstage),
      ownerExternalId: readString(properties.hubspot_owner_id),
      companyExternalIds: extractHubspotAssociations("OPPORTUNITY", externalId, associationsData)
        .filter((association) => association.toType === "COMPANY")
        .map((association) => association.toId),
      contactExternalIds: extractHubspotAssociations("OPPORTUNITY", externalId, associationsData)
        .filter((association) => association.toType === "CONTACT")
        .map((association) => association.toId),
      dueDate: readDate(properties.closedate),
      updatedAt,
      raw: item as Record<string, unknown>,
    });
    associations.push(...extractHubspotAssociations("OPPORTUNITY", externalId, associationsData));
  }

  for (const item of notesResponse.results ?? []) {
    const properties = asHubSpotProperties(item.properties);
    const associationsData = asHubSpotAssociations(item.associations);
    const occurredAt = readDate(properties.hs_timestamp) ?? new Date();
    if (updatedAfter && occurredAt.toISOString() <= updatedAfter) continue;
    // Skip rows with no HubSpot id: a coerced "" externalId would collide
    // across all such rows and overwrite them on re-import.
    if (!item.id) continue;
    const externalId = String(item.id);
    notes.push({
      externalId,
      sourceType: ImportSourceType.HUBSPOT,
      title: `HubSpot Note ${externalId}`,
      body: readString(properties.hs_note_body) ?? "",
      occurredAt,
      ownerExternalId: readString(properties.hubspot_owner_id),
      companyExternalIds: extractHubspotAssociations("NOTE", externalId, associationsData)
        .filter((association) => association.toType === "COMPANY")
        .map((association) => association.toId),
      contactExternalIds: extractHubspotAssociations("NOTE", externalId, associationsData)
        .filter((association) => association.toType === "CONTACT")
        .map((association) => association.toId),
      opportunityExternalIds: extractHubspotAssociations("NOTE", externalId, associationsData)
        .filter((association) => association.toType === "DEAL" || association.toType === "OPPORTUNITY")
        .map((association) => association.toId),
      raw: item as Record<string, unknown>,
    });
    associations.push(...extractHubspotAssociations("NOTE", externalId, associationsData));
  }

  return {
    sourceType: ImportSourceType.HUBSPOT,
    accountId: source.externalAccountId,
    accountLabel: source.externalAccountLabel ?? "HubSpot 工作区",
    owners,
    contacts,
    companies,
    opportunities,
    meetings: [],
    notes,
    tasks: [],
    associations: uniqueStrings(associations.map((item) => `${item.fromType}:${item.fromId}:${item.toType}:${item.toId}`)).map((key) => {
      const [fromType, fromId, toType, toId] = key.split(":");
      return { fromType, fromId, toType, toId };
    }),
    usedMock: false,
  };
}

export async function previewHubSpotImport(sourceId: string) {
  return buildCrmPreview(await fetchHubSpotDataset(sourceId, true, false));
}

export async function runHubSpotImport(input: {
  workspaceId: string;
  userId?: string | null;
  sourceId: string;
  incremental?: boolean;
}) {
  const source = await db.importSource.findUnique({ where: { id: input.sourceId } });
  if (!source) {
    throw new Error("HubSpot 导入来源不存在");
  }
  const dataset = await fetchHubSpotDataset(input.sourceId, false, Boolean(input.incremental));
  return runCrmImport({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    source,
    dataset,
    jobType: input.incremental ? ImportJobType.INCREMENTAL_SYNC : ImportJobType.INITIAL_IMPORT,
  });
}
