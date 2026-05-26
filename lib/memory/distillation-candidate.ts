import { type MemoryFactType, type ObjectType, type SourceType } from "@prisma/client";

export type DistillationFactInput = {
  id: string;
  objectType: ObjectType;
  objectId: string;
  factType: MemoryFactType;
  title: string;
  content: string;
  normalizedValue: unknown;
  sourceType: SourceType;
  sourceId: string;
  status: string;
  confidence: number;
  importance: number;
  confirmedByUser: boolean;
  createdAt: Date;
  updatedAt: Date;
  evidenceRefs?: string[];
  priorReviewDecisions?: Array<{
    decision: "approve" | "reject" | "defer";
    groupKey: string;
    decidedAt: Date;
  }>;
};

export type DistillationCandidate = {
  candidateId: string;
  groupKey: string;
  objectType: ObjectType;
  objectId: string;
  factType: MemoryFactType;
  title: string;
  summary: string;
  sourceFactIds: string[];
  evidenceRefs: string[];
  sourceRefs: string[];
  repeatCount: number;
  confidence: number;
  reviewPosture: "review_required";
  boundaryNote: string;
  createdFrom: "repeated_normalized_fact";
  latestSourceAt: Date;
};

export type OmittedCandidateGroup = {
  groupKey: string;
  reason: "rejected_by_review" | "deferred_by_review";
};

export type DistillationCandidateResult = {
  candidates: DistillationCandidate[];
  omitted: OmittedCandidateGroup[];
};

const BOUNDARY_NOTE =
  "Distillation candidates require human review before any promotion. " +
  "Candidates cannot write canonical facts, cannot auto-promote, and cannot change recommendation ranking.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NORMALIZED_VALUE_KEYS = ["factKey", "normalizedFactKey", "semanticKey", "field", "attribute", "value", "text"];

function extractNormalizedSemanticText(value: unknown): string {
  if (value === null || value === undefined) return "";

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
  }

  if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
    return String(parsed)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  if (isRecord(parsed)) {
    for (const key of NORMALIZED_VALUE_KEYS) {
      const part = parsed[key];
      if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") {
        const normalized = String(part)
          .normalize("NFKC")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim();
        if (normalized) return normalized;
      }
    }
  }

  return "";
}

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function buildDistillationCandidateGroupKey(fact: DistillationFactInput): string | null {
  let semantic = extractNormalizedSemanticText(fact.normalizedValue);
  if (!semantic) {
    semantic = normalizeText(fact.content);
  }
  if (!semantic) {
    semantic = normalizeText(fact.title);
  }
  if (!semantic) {
    return null;
  }
  return [fact.objectType, fact.objectId, fact.factType, semantic].join("|");
}

function buildCandidateId(groupKey: string): string {
  let hash = 0;
  for (let i = 0; i < groupKey.length; i++) {
    hash = (Math.imul(31, hash) + groupKey.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `distill-${hex}`;
}

export function detectDistillationCandidates(
  facts: DistillationFactInput[],
): DistillationCandidateResult {
  const groups = new Map<string, DistillationFactInput[]>();

  for (const fact of facts) {
    const key = buildDistillationCandidateGroupKey(fact);
    if (key === null) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.push(fact);
    } else {
      groups.set(key, [fact]);
    }
  }

  const candidates: DistillationCandidate[] = [];
  const omitted: OmittedCandidateGroup[] = [];

  const sortedKeys = Array.from(groups.keys()).sort();

  for (const groupKey of sortedKeys) {
    const members = groups.get(groupKey)!;

    if (members.length < 2) {
      continue;
    }

    const priorDecisions = members.flatMap((f) => f.priorReviewDecisions ?? []);
    const relevantDecisions = priorDecisions.filter((d) => d.groupKey === groupKey);

    const hasSortedDecisions = relevantDecisions.sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());
    const latestDecision = hasSortedDecisions[0];

    if (latestDecision?.decision === "reject") {
      omitted.push({ groupKey, reason: "rejected_by_review" });
      continue;
    }

    if (latestDecision?.decision === "defer") {
      omitted.push({ groupKey, reason: "deferred_by_review" });
      continue;
    }

    const sortedMembers = members.slice().sort((a, b) => {
      const dateA = a.createdAt.getTime();
      const dateB = b.createdAt.getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id.localeCompare(b.id);
    });

    const confirmedFacts = sortedMembers.filter((f) => f.confirmedByUser);
    const allConfidences = sortedMembers.map((f) => f.confidence);
    const maxConfidence = Math.max(...allConfidences);
    const boostedConfidence = confirmedFacts.length > 0
      ? Math.min(maxConfidence + 5, 100)
      : maxConfidence;

    const latestMember = sortedMembers.reduce((latest, f) =>
      f.updatedAt.getTime() > latest.updatedAt.getTime() ? f : latest,
    );

    const allEvidenceRefs = Array.from(
      new Set(sortedMembers.flatMap((f) => f.evidenceRefs ?? [])),
    ).sort();

    const allSourceRefs = Array.from(
      new Set(sortedMembers.map((f) => `${f.sourceType}:${f.sourceId}`)),
    ).sort();

    const representativeMember = confirmedFacts.length > 0
      ? confirmedFacts[confirmedFacts.length - 1]
      : sortedMembers[sortedMembers.length - 1];

    const summaryParts = [`Repeated fact observed ${sortedMembers.length} times.`];
    if (confirmedFacts.length > 0) {
      summaryParts.push(`${confirmedFacts.length} confirmed by user.`);
    }

    candidates.push({
      candidateId: buildCandidateId(groupKey),
      groupKey,
      objectType: sortedMembers[0].objectType,
      objectId: sortedMembers[0].objectId,
      factType: sortedMembers[0].factType,
      title: representativeMember.title,
      summary: summaryParts.join(" "),
      sourceFactIds: sortedMembers.map((f) => f.id),
      evidenceRefs: allEvidenceRefs,
      sourceRefs: allSourceRefs,
      repeatCount: sortedMembers.length,
      confidence: boostedConfidence,
      reviewPosture: "review_required",
      boundaryNote: BOUNDARY_NOTE,
      createdFrom: "repeated_normalized_fact",
      latestSourceAt: latestMember.updatedAt,
    });
  }

  candidates.sort((a, b) => {
    if (a.objectType !== b.objectType) return a.objectType.localeCompare(b.objectType);
    if (a.objectId !== b.objectId) return a.objectId.localeCompare(b.objectId);
    if (a.factType !== b.factType) return a.factType.localeCompare(b.factType);
    return a.candidateId.localeCompare(b.candidateId);
  });

  return { candidates, omitted };
}
