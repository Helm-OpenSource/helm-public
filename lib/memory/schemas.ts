import { z } from "zod";

export const objectTypeSchema = z.enum([
  "CONTACT",
  "COMPANY",
  "OPPORTUNITY",
  "MEETING",
  "ACTION_ITEM",
  "APPROVAL_TASK",
  "POLICY_RULE",
  "EMAIL_THREAD",
]);

export const sourceTypeSchema = z.enum([
  "EMAIL_MESSAGE",
  "EMAIL_THREAD",
  "MEETING_NOTE",
  "MEETING",
  "ACTION_ITEM",
  "APPROVAL_TASK",
  "POLICY_RULE",
  "CSV_IMPORT",
  "USER_EDIT",
  "SYSTEM_INFERENCE",
  "OPENCLAW",
]);

export const memoryFactTypeSchema = z.enum([
  "RELATIONSHIP",
  "PREFERENCE",
  "OBJECTION",
  "BLOCKER",
  "COMMITMENT",
  "NEXT_STEP",
  "STAGE_SIGNAL",
  "RISK_SIGNAL",
  "SUMMARY",
  "POLICY_PATTERN",
  "ACTION_PATTERN",
]);

export const memoryStatusSchema = z.enum(["ACTIVE", "OBSERVED", "ARCHIVED", "INVALID"]);
export const correctionTypeSchema = z.enum([
  "CONTENT_UPDATE",
  "SOURCE_REBIND",
  "OBJECT_REBIND",
  "INVALIDATE",
  "DELETE",
  "CONFIDENCE_ADJUST",
  "STATUS_CHANGE",
  "CONFIRM",
]);
export const commitmentStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "FULFILLED", "CANCELED", "OVERDUE"]);
export const blockerStatusSchema = z.enum(["OPEN", "MONITORING", "RESOLVED", "IGNORED"]);

export const createMemoryFactSchema = z.object({
  objectType: objectTypeSchema,
  objectId: z.string().min(1),
  factType: memoryFactTypeSchema,
  title: z.string().min(2),
  content: z.string().min(2),
  sourceType: sourceTypeSchema,
  sourceId: z.string().min(1),
  confidence: z.number().int().min(0).max(100).optional(),
  importance: z.number().int().min(0).max(100).optional(),
  freshnessScore: z.number().int().min(0).max(100).optional(),
  normalizedValue: z.record(z.string(), z.unknown()).optional(),
});

export const correctMemoryFactSchema = z.object({
  correctionType: correctionTypeSchema,
  afterValue: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().trim().max(300).optional(),
});

export const invalidateMemoryFactSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const deleteMemoryFactSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const createCommitmentSchema = z.object({
  title: z.string().min(2),
  commitmentText: z.string().min(2),
  sourceType: sourceTypeSchema,
  sourceId: z.string().min(1),
  relatedContactId: z.string().optional(),
  relatedCompanyId: z.string().optional(),
  relatedOpportunityId: z.string().optional(),
  relatedMeetingId: z.string().optional(),
  ownerUserId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

export const updateCommitmentStatusSchema = z.object({
  status: commitmentStatusSchema,
  statusNote: z.string().trim().max(300).optional(),
});

export const createBlockerSchema = z.object({
  title: z.string().min(2),
  blockerType: z.string().min(2),
  blockerText: z.string().min(2),
  severity: z.number().int().min(0).max(100).optional(),
  sourceType: sourceTypeSchema,
  sourceId: z.string().min(1),
  relatedContactId: z.string().optional(),
  relatedCompanyId: z.string().optional(),
  relatedOpportunityId: z.string().optional(),
  relatedMeetingId: z.string().optional(),
});

export const resolveBlockerSchema = z.object({
  resolutionNote: z.string().trim().max(300).optional(),
});

export const updateBlockerStatusSchema = z.object({
  status: blockerStatusSchema,
  resolutionNote: z.string().trim().max(300).optional(),
});

export const processMeetingMemorySchema = z.object({
  force: z.boolean().optional(),
});

export const processImportedMeetingNoteSchema = z.object({
  meetingId: z.string().min(1),
  force: z.boolean().optional(),
});
