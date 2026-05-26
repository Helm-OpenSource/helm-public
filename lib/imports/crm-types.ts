import type { ImportSourceType, OpportunityType, RecordSource, RiskLevel } from "@prisma/client";

export type ExternalOwner = {
  externalId: string;
  name: string;
  email?: string | null;
};

export type ExternalPerson = {
  externalId: string;
  sourceType: ImportSourceType;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  ownerExternalId?: string | null;
  companyExternalIds?: string[];
  updatedAt?: Date | null;
  raw: Record<string, unknown>;
};

export type ExternalCompany = {
  externalId: string;
  sourceType: ImportSourceType;
  name: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  ownerExternalId?: string | null;
  contactExternalIds?: string[];
  updatedAt?: Date | null;
  raw: Record<string, unknown>;
};

export type ExternalOpportunity = {
  externalId: string;
  sourceType: ImportSourceType;
  title: string;
  amount?: number | null;
  type: OpportunityType;
  stageLabel?: string | null;
  ownerExternalId?: string | null;
  companyExternalIds?: string[];
  contactExternalIds?: string[];
  dueDate?: Date | null;
  updatedAt?: Date | null;
  note?: string | null;
  raw: Record<string, unknown>;
};

export type ExternalMeeting = {
  externalId: string;
  sourceType: ImportSourceType;
  title: string;
  startsAt: Date;
  endsAt: Date;
  ownerExternalId?: string | null;
  companyExternalIds?: string[];
  contactExternalIds?: string[];
  opportunityExternalIds?: string[];
  noteBody?: string | null;
  location?: string | null;
  updatedAt?: Date | null;
  raw: Record<string, unknown>;
};

export type ExternalNote = {
  externalId: string;
  sourceType: ImportSourceType;
  title: string;
  body: string;
  occurredAt: Date;
  ownerExternalId?: string | null;
  companyExternalIds?: string[];
  contactExternalIds?: string[];
  opportunityExternalIds?: string[];
  raw: Record<string, unknown>;
};

export type ExternalTask = {
  externalId: string;
  sourceType: ImportSourceType;
  title: string;
  body?: string | null;
  dueDate?: Date | null;
  ownerExternalId?: string | null;
  companyExternalIds?: string[];
  contactExternalIds?: string[];
  opportunityExternalIds?: string[];
  completed?: boolean;
  priority?: RiskLevel | null;
  raw: Record<string, unknown>;
};

export type ExternalAssociation = {
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  label?: string | null;
};

export type CrmDataset = {
  sourceType: ImportSourceType;
  accountId?: string | null;
  accountLabel?: string | null;
  owners: ExternalOwner[];
  contacts: ExternalPerson[];
  companies: ExternalCompany[];
  opportunities: ExternalOpportunity[];
  meetings: ExternalMeeting[];
  notes: ExternalNote[];
  tasks: ExternalTask[];
  associations: ExternalAssociation[];
  nextCursor?: string | null;
  usedMock: boolean;
};

export type CrmPreview = {
  sourceType: ImportSourceType;
  accountLabel: string;
  objectCounts: {
    contacts: number;
    companies: number;
    opportunities: number;
    meetings: number;
    notes: number;
    tasks: number;
    associations: number;
  };
  samples: {
    contacts: ExternalPerson[];
    companies: ExternalCompany[];
    opportunities: ExternalOpportunity[];
    meetings: ExternalMeeting[];
    notes: ExternalNote[];
    tasks: ExternalTask[];
  };
  usedMock: boolean;
};

export type ImportSummary = {
  jobId: string;
  sourceType: ImportSourceType;
  importedCounts: {
    contacts: number;
    companies: number;
    opportunities: number;
    meetings: number;
    notes: number;
    tasks: number;
  };
  linkedCounts: {
    contactCompanyLinks: number;
    opportunityCompanyLinks: number;
    opportunityContactLinks: number;
  };
  reviewCount: number;
  createdActionCount: number;
  generatedMeetingNotes: number;
  warmup: {
    processedMeetings: number;
    refreshedObjects: number;
    generatedRecommendations: number;
    detectedCommitments: number;
    detectedBlockers: number;
  } | null;
  usedMock: boolean;
};

export type TimelineRecordSource = RecordSource | "HUBSPOT" | "SALESFORCE";

export function normalizeName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeDomain(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function safeJsonString(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "serialize_failed" });
  }
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? "").trim()).filter(Boolean)));
}
