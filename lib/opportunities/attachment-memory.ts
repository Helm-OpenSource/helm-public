import { safeParseJson } from "@/lib/utils";

export const OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE =
  "opportunity-attachment-upload";

export type OpportunityAttachmentMemoryPayload = {
  version: 1;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedAt: string;
};

export type OpportunityAttachmentItem = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedAt: Date;
  createdAt: Date;
};

export function buildOpportunityAttachmentMemoryPayload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedAt?: Date;
}): OpportunityAttachmentMemoryPayload {
  return {
    version: 1,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    url: input.url,
    uploadedAt: (input.uploadedAt ?? new Date()).toISOString(),
  };
}

export function parseOpportunityAttachmentMemoryEntry(input: {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}): OpportunityAttachmentItem | null {
  const parsed = safeParseJson<Partial<OpportunityAttachmentMemoryPayload>>(
    input.content,
    {},
  );
  if (
    parsed.version !== 1 ||
    typeof parsed.fileName !== "string" ||
    typeof parsed.mimeType !== "string" ||
    typeof parsed.sizeBytes !== "number" ||
    typeof parsed.url !== "string" ||
    typeof parsed.uploadedAt !== "string"
  ) {
    return null;
  }

  const uploadedAt = new Date(parsed.uploadedAt);
  if (Number.isNaN(uploadedAt.getTime())) {
    return null;
  }

  return {
    id: input.id,
    title: input.title,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    url: parsed.url,
    uploadedAt,
    createdAt: input.createdAt,
  };
}
