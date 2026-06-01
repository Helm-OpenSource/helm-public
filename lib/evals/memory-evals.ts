import { MemoryCorrectionType, MemoryFactType, ObjectType, SourceType, type PrismaClient } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";
import memoryGoldenCases from "@/evals/memory/golden-samples.json";
import distillationCandidateFixtures from "@/evals/memory/distillation-candidates.json";
import { db } from "@/lib/db";
import { includesInAny, toRate } from "@/lib/evals/shared";
import { detectDistillationCandidates, type DistillationFactInput } from "@/lib/memory/distillation-candidate";

type MemoryGoldenCase = {
  id: string;
  meetingTitle: string;
  expectedFacts: string[];
  expectedCommitments: string[];
  expectedBlockers: string[];
};

export type MemoryEvalCategorySummary = {
  id: "relevance" | "stability" | "duplicate_omission";
  label: string;
  passedCases: number;
  totalCases: number;
  passRate: number;
  failedCaseIds: string[];
};

export type MemoryCaseResult = {
  id: string;
  meetingTitle: string;
  passed: boolean;
  factHits: number;
  factTotal: number;
  commitmentHits: number;
  commitmentTotal: number;
  blockerHits: number;
  blockerTotal: number;
  missingFacts: string[];
  missingCommitments: string[];
  missingBlockers: string[];
  misattributedFacts: string[];
  misattributedCommitments: string[];
  misattributedBlockers: string[];
  duplicateFacts: number;
  duplicateCommitments: number;
  duplicateBlockers: number;
};

type MemoryGoldenSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  factHitRate: number;
  commitmentHitRate: number;
  blockerHitRate: number;
  categorySummary: MemoryEvalCategorySummary[];
  cases: MemoryCaseResult[];
  distillationCandidateSummary: DistillationCandidateSummary;
};

export type DistillationCandidateEvalCaseResult = {
  id: string;
  passed: boolean;
  candidateCount: number;
  omittedCount: number;
  missingBoundarySnippets: string[];
  failedReason?: string;
};

export type DistillationCandidateSummary = {
  totalCases: number;
  passedCases: number;
  passRate: number;
  cases: DistillationCandidateEvalCaseResult[];
};

export type MemoryExtractionQualityOverview = {
  extractedFacts: number;
  extractedCommitments: number;
  extractedBlockers: number;
  corrections: number;
  confirmations: number;
  invalidations: number;
  deletions: number;
  correctionRate: number;
  invalidationRate: number;
  sourceBreakdown: Array<{
    sourceType: string;
    facts: number;
    commitments: number;
    blockers: number;
  }>;
  errorModes: Array<{
    label: string;
    count: number;
  }>;
  goldenSummary: MemoryGoldenSummary;
};

function loadMemoryGoldenCases() {
  return memoryGoldenCases as MemoryGoldenCase[];
}

function normalizeMemoryEvalCandidate(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

type MemoryEvalFact = {
  title?: string | null;
  content?: string | null;
  normalizedValue?: string | null;
};

function isAggregateMeetingSummaryFact(fact: MemoryEvalFact): boolean {
  if (fact.title && (fact.title.includes("会议摘要") || fact.title.endsWith("会议摘要"))) {
    return true;
  }
  if (fact.normalizedValue) {
    try {
      const parsed = JSON.parse(fact.normalizedValue);
      if (
        parsed &&
        typeof parsed === "object" &&
        "meetingId" in parsed &&
        ("contactIds" in parsed || "opportunityId" in parsed || "companyId" in parsed)
      ) {
        return true;
      }
    } catch {
      // not JSON, not aggregate
    }
  }
  return false;
}

export function countDuplicateMemoryEvalFacts(facts: MemoryEvalFact[]): number {
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const fact of facts) {
    if (isAggregateMeetingSummaryFact(fact)) continue;
    const raw = fact.content || fact.title;
    const normalized = normalizeMemoryEvalCandidate(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(normalized);
  }

  return duplicateCount;
}

export function countDuplicateMemoryEvalCandidates(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const value of values) {
    const normalized = normalizeMemoryEvalCandidate(value);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(normalized);
  }

  return duplicateCount;
}

export function buildMemoryEvalCategorySummary(results: MemoryCaseResult[]): MemoryEvalCategorySummary[] {
  const totalCases = results.length;
  const categories: Array<{
    id: MemoryEvalCategorySummary["id"];
    label: string;
    predicate: (result: MemoryCaseResult) => boolean;
  }> = [
    {
      id: "relevance",
      label: "Expected memory relevance",
      predicate: (result) =>
        result.missingFacts.length === 0 &&
        result.missingCommitments.length === 0 &&
        result.missingBlockers.length === 0,
    },
    {
      id: "stability",
      label: "Attribution stability",
      predicate: (result) =>
        result.misattributedFacts.length === 0 &&
        result.misattributedCommitments.length === 0 &&
        result.misattributedBlockers.length === 0,
    },
    {
      id: "duplicate_omission",
      label: "Duplicate / omission guard",
      predicate: (result) =>
        result.missingFacts.length === 0 &&
        result.missingCommitments.length === 0 &&
        result.missingBlockers.length === 0 &&
        result.duplicateFacts === 0 &&
        result.duplicateCommitments === 0 &&
        result.duplicateBlockers === 0,
    },
  ];

  return categories.map((category) => {
    const failedCaseIds = results
      .filter((result) => !category.predicate(result))
      .map((result) => result.id);
    const passedCases = totalCases - failedCaseIds.length;
    return {
      id: category.id,
      label: category.label,
      passedCases,
      totalCases,
      passRate: toRate(passedCases, totalCases),
      failedCaseIds,
    };
  });
}

type DistillationFixturePriorDecision = {
  decision: "approve" | "reject" | "defer";
  groupKey: string;
  decidedAt: string;
};

type DistillationFixtureFact = {
  id: string;
  objectType: string;
  objectId: string;
  factType: string;
  title: string;
  content: string;
  normalizedValue: unknown;
  sourceType: string;
  sourceId: string;
  status: string;
  confidence: number;
  importance: number;
  confirmedByUser: boolean;
  createdAt: string;
  updatedAt: string;
  evidenceRefs: string[];
  priorReviewDecisions: DistillationFixturePriorDecision[];
};

type DistillationFixtureCase = {
  id: string;
  description: string;
  facts: DistillationFixtureFact[];
  expectedCandidateCount: number;
  expectedOmittedCount: number;
  expectedSourceFactIds?: string[][];
  expectedBoundarySnippets?: string[];
  expectedOmittedReasons?: string[];
};

function loadDistillationFactsFromFixture(fixtureFacts: DistillationFixtureFact[]): DistillationFactInput[] {
  return fixtureFacts.map((f) => ({
    id: f.id,
    objectType: f.objectType as ObjectType,
    objectId: f.objectId,
    factType: f.factType as MemoryFactType,
    title: f.title,
    content: f.content,
    normalizedValue: f.normalizedValue,
    sourceType: f.sourceType as SourceType,
    sourceId: f.sourceId,
    status: f.status,
    confidence: f.confidence,
    importance: f.importance,
    confirmedByUser: f.confirmedByUser,
    createdAt: new Date(f.createdAt),
    updatedAt: new Date(f.updatedAt),
    evidenceRefs: f.evidenceRefs,
    priorReviewDecisions: f.priorReviewDecisions.map((d) => ({
      decision: d.decision,
      groupKey: d.groupKey,
      decidedAt: new Date(d.decidedAt),
    })),
  }));
}

export function runMemoryDistillationCandidateEval(): DistillationCandidateSummary {
  const fixtures = distillationCandidateFixtures as DistillationFixtureCase[];
  const cases: DistillationCandidateEvalCaseResult[] = [];

  for (const fixture of fixtures) {
    const facts = loadDistillationFactsFromFixture(fixture.facts);
    const result = detectDistillationCandidates(facts);

    const expectedCandidateCount = fixture.expectedCandidateCount;
    const expectedOmittedCount = fixture.expectedOmittedCount;
    const expectedSourceFactIds = fixture.expectedSourceFactIds ?? [];
    const expectedBoundarySnippets = fixture.expectedBoundarySnippets ?? [];
    const expectedOmittedReasons = fixture.expectedOmittedReasons ?? [];

    const candidateCount = result.candidates.length;
    const omittedCount = result.omitted.length;
    const failedReasons: string[] = [];

    if (candidateCount !== expectedCandidateCount) {
      failedReasons.push(`expected ${expectedCandidateCount} candidate(s), got ${candidateCount}`);
    }

    if (omittedCount !== expectedOmittedCount) {
      failedReasons.push(`expected ${expectedOmittedCount} omitted group(s), got ${omittedCount}`);
    }

    for (let i = 0; i < expectedSourceFactIds.length; i++) {
      const expected = expectedSourceFactIds[i];
      const candidate = result.candidates[i];
      if (!candidate) {
        failedReasons.push(`candidate ${i} missing`);
      } else if (JSON.stringify(candidate.sourceFactIds) !== JSON.stringify(expected)) {
        failedReasons.push(
          `candidate ${i} sourceFactIds: expected [${expected.join(",")}], got [${candidate.sourceFactIds.join(",")}]`,
        );
      }
    }

    for (let i = 0; i < expectedOmittedReasons.length; i++) {
      const expected = expectedOmittedReasons[i];
      const omitted = result.omitted[i];
      if (!omitted) {
        failedReasons.push(`omitted group ${i} missing`);
      } else if (omitted.reason !== expected) {
        failedReasons.push(`omitted group ${i} reason: expected ${expected}, got ${omitted.reason}`);
      }
    }

    const missingBoundarySnippets: string[] = [];
    if (expectedBoundarySnippets.length > 0 && result.candidates.length > 0) {
      const firstCandidate = result.candidates[0];
      for (const snippet of expectedBoundarySnippets) {
        if (!firstCandidate.boundaryNote.includes(snippet)) {
          missingBoundarySnippets.push(snippet);
        }
      }
      if (missingBoundarySnippets.length > 0) {
        failedReasons.push(`missing boundary snippets: ${missingBoundarySnippets.join("; ")}`);
      }
    }

    const passed = failedReasons.length === 0;
    cases.push({
      id: fixture.id,
      passed,
      candidateCount,
      omittedCount,
      missingBoundarySnippets,
      ...(failedReasons.length > 0 ? { failedReason: failedReasons.join("; ") } : {}),
    });
  }

  const passedCases = cases.filter((c) => c.passed).length;
  return {
    totalCases: cases.length,
    passedCases,
    passRate: toRate(passedCases, cases.length),
    cases,
  };
}

async function findMisattributedMatches(prisma: PrismaClient, workspaceId: string, meetingId: string, type: "fact" | "commitment" | "blocker", expectedText: string) {
  if (type === "fact") {
    const items = await prisma.memoryFact.findMany({
      where: {
        workspaceId,
        sourceType: SourceType.MEETING_NOTE,
        NOT: {
          sourceId: meetingId,
        },
      },
      select: {
        title: true,
        content: true,
      },
    });
    return items.some((item) => includesInAny([item.title, item.content], expectedText));
  }

  if (type === "commitment") {
    const items = await prisma.commitment.findMany({
      where: {
        workspaceId,
        sourceType: SourceType.MEETING_NOTE,
        NOT: {
          sourceId: meetingId,
        },
      },
      select: {
        title: true,
        commitmentText: true,
      },
    });
    return items.some((item) => includesInAny([item.title, item.commitmentText], expectedText));
  }

  const items = await prisma.blocker.findMany({
    where: {
      workspaceId,
      sourceType: SourceType.MEETING_NOTE,
      NOT: {
        sourceId: meetingId,
      },
    },
    select: {
      title: true,
      blockerText: true,
    },
  });
  return items.some((item) => includesInAny([item.title, item.blockerText], expectedText));
}

export async function runMemoryGoldenEval(prisma: PrismaClient = db): Promise<MemoryGoldenSummary> {
  const cases = loadMemoryGoldenCases();
  const results: MemoryCaseResult[] = [];
  let totalFactExpected = 0;
  let totalFactHits = 0;
  let totalCommitmentExpected = 0;
  let totalCommitmentHits = 0;
  let totalBlockerExpected = 0;
  let totalBlockerHits = 0;

  for (const item of cases) {
    const meeting = await prisma.meeting.findFirst({
      where: { title: item.meetingTitle },
      select: { id: true, workspaceId: true, title: true },
    });

    if (!meeting) {
      results.push({
        id: item.id,
        meetingTitle: item.meetingTitle,
        passed: false,
        factHits: 0,
        factTotal: item.expectedFacts.length,
        commitmentHits: 0,
        commitmentTotal: item.expectedCommitments.length,
        blockerHits: 0,
        blockerTotal: item.expectedBlockers.length,
        missingFacts: [...item.expectedFacts],
        missingCommitments: [...item.expectedCommitments],
        missingBlockers: [...item.expectedBlockers],
        misattributedFacts: [],
        misattributedCommitments: [],
        misattributedBlockers: [],
        duplicateFacts: 0,
        duplicateCommitments: 0,
        duplicateBlockers: 0,
      });
      continue;
    }

    const [facts, commitments, blockers] = await Promise.all([
      prisma.memoryFact.findMany({
        where: {
          workspaceId: meeting.workspaceId,
          sourceType: SourceType.MEETING_NOTE,
          sourceId: meeting.id,
        },
        select: {
          title: true,
          content: true,
          normalizedValue: true,
        },
      }),
      prisma.commitment.findMany({
        where: {
          workspaceId: meeting.workspaceId,
          sourceType: SourceType.MEETING_NOTE,
          sourceId: meeting.id,
        },
        select: {
          title: true,
          commitmentText: true,
        },
      }),
      prisma.blocker.findMany({
        where: {
          workspaceId: meeting.workspaceId,
          sourceType: SourceType.MEETING_NOTE,
          sourceId: meeting.id,
        },
        select: {
          title: true,
          blockerText: true,
        },
      }),
    ]);

    const factPool = facts.flatMap((item) => [item.title, item.content]);
    const commitmentPool = commitments.flatMap((item) => [item.title, item.commitmentText]);
    const blockerPool = blockers.flatMap((item) => [item.title, item.blockerText]);
    const duplicateFacts = countDuplicateMemoryEvalFacts(facts);
    const duplicateCommitments = countDuplicateMemoryEvalCandidates(
      commitments.map((item) => item.commitmentText || item.title),
    );
    const duplicateBlockers = countDuplicateMemoryEvalCandidates(blockers.map((item) => item.blockerText || item.title));

    const missingFacts = item.expectedFacts.filter((expected) => !includesInAny(factPool, expected));
    const missingCommitments = item.expectedCommitments.filter((expected) => !includesInAny(commitmentPool, expected));
    const missingBlockers = item.expectedBlockers.filter((expected) => !includesInAny(blockerPool, expected));

    const [misattributedFacts, misattributedCommitments, misattributedBlockers] = await Promise.all([
      Promise.all(
        missingFacts.map(async (expected) => ((await findMisattributedMatches(prisma, meeting.workspaceId, meeting.id, "fact", expected)) ? expected : null)),
      ).then((items) => items.filter(Boolean) as string[]),
      Promise.all(
        missingCommitments.map(async (expected) =>
          ((await findMisattributedMatches(prisma, meeting.workspaceId, meeting.id, "commitment", expected)) ? expected : null),
        ),
      ).then((items) => items.filter(Boolean) as string[]),
      Promise.all(
        missingBlockers.map(async (expected) =>
          ((await findMisattributedMatches(prisma, meeting.workspaceId, meeting.id, "blocker", expected)) ? expected : null),
        ),
      ).then((items) => items.filter(Boolean) as string[]),
    ]);

    const factHits = item.expectedFacts.length - missingFacts.length;
    const commitmentHits = item.expectedCommitments.length - missingCommitments.length;
    const blockerHits = item.expectedBlockers.length - missingBlockers.length;

    totalFactExpected += item.expectedFacts.length;
    totalFactHits += factHits;
    totalCommitmentExpected += item.expectedCommitments.length;
    totalCommitmentHits += commitmentHits;
    totalBlockerExpected += item.expectedBlockers.length;
    totalBlockerHits += blockerHits;

    results.push({
      id: item.id,
      meetingTitle: item.meetingTitle,
      passed: missingFacts.length === 0 && missingCommitments.length === 0 && missingBlockers.length === 0,
      factHits,
      factTotal: item.expectedFacts.length,
      commitmentHits,
      commitmentTotal: item.expectedCommitments.length,
      blockerHits,
      blockerTotal: item.expectedBlockers.length,
      missingFacts,
      missingCommitments,
      missingBlockers,
      misattributedFacts,
      misattributedCommitments,
      misattributedBlockers,
      duplicateFacts,
      duplicateCommitments,
      duplicateBlockers,
    });
  }

  const passedCases = results.filter((result) => result.passed).length;
  const categorySummary = buildMemoryEvalCategorySummary(results);
  const distillationCandidateSummary = runMemoryDistillationCandidateEval();

  return {
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    factHitRate: toRate(totalFactHits, totalFactExpected),
    commitmentHitRate: toRate(totalCommitmentHits, totalCommitmentExpected),
    blockerHitRate: toRate(totalBlockerHits, totalBlockerExpected),
    categorySummary,
    cases: results,
    distillationCandidateSummary,
  };
}

export async function getMemoryExtractionQualityOverview(workspaceId: string, windowStart = startOfDay(subDays(new Date(), 29)), prisma: PrismaClient = db): Promise<MemoryExtractionQualityOverview> {
  const [facts, commitments, blockers, corrections, goldenSummary] = await Promise.all([
    prisma.memoryFact.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
        },
        sourceType: {
          in: [SourceType.MEETING_NOTE, SourceType.CAPTURE_SESSION],
        },
      },
      select: {
        sourceType: true,
      },
    }),
    prisma.commitment.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
        },
        sourceType: {
          in: [SourceType.MEETING_NOTE, SourceType.CAPTURE_SESSION],
        },
      },
      select: {
        sourceType: true,
      },
    }),
    prisma.blocker.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
        },
        sourceType: {
          in: [SourceType.MEETING_NOTE, SourceType.CAPTURE_SESSION],
        },
      },
      select: {
        sourceType: true,
      },
    }),
    prisma.memoryCorrection.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
        },
      },
      select: {
        correctionType: true,
      },
    }),
    runMemoryGoldenEval(prisma),
  ]);

  const extractedFacts = facts.length;
  const extractedCommitments = commitments.length;
  const extractedBlockers = blockers.length;
  const extractedTotal = extractedFacts + extractedCommitments + extractedBlockers;
  const confirmations = corrections.filter((item) => item.correctionType === MemoryCorrectionType.CONFIRM).length;
  const invalidations = corrections.filter((item) => item.correctionType === MemoryCorrectionType.INVALIDATE).length;
  const deletions = corrections.filter((item) => item.correctionType === MemoryCorrectionType.DELETE).length;

  const sourceTypes = [SourceType.MEETING_NOTE, SourceType.CAPTURE_SESSION];
  const sourceBreakdown = sourceTypes.map((sourceType) => ({
    sourceType,
    facts: facts.filter((item) => item.sourceType === sourceType).length,
    commitments: commitments.filter((item) => item.sourceType === sourceType).length,
    blockers: blockers.filter((item) => item.sourceType === sourceType).length,
  }));

  const correctionBuckets = Array.from(
    corrections.reduce((acc, correction) => {
      let label = "内容或置信度偏差";
      if (
        correction.correctionType === MemoryCorrectionType.INVALIDATE ||
        correction.correctionType === MemoryCorrectionType.DELETE
      ) {
        label = "误提取或已失效";
      } else if (
        correction.correctionType === MemoryCorrectionType.OBJECT_REBIND ||
        correction.correctionType === MemoryCorrectionType.SOURCE_REBIND
      ) {
        label = "错归属";
      } else if (correction.correctionType === MemoryCorrectionType.CONFIRM) {
        label = "人工确认";
      }

      acc.set(label, (acc.get(label) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);

  return {
    extractedFacts,
    extractedCommitments,
    extractedBlockers,
    corrections: corrections.length,
    confirmations,
    invalidations,
    deletions,
    correctionRate: toRate(corrections.length, extractedTotal),
    invalidationRate: toRate(invalidations + deletions, extractedFacts),
    sourceBreakdown,
    errorModes: correctionBuckets,
    goldenSummary,
  };
}
