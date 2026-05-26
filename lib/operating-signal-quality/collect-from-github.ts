// GitHub evidence collector — 把 commit / PR / CI 结果转成 OperatingSignalQualityEvidence。
//
// 设计原则：
// - 启发式 + 显式覆盖：path 模式能稳定推断 readiness + prInflation，但 delivery/signal/collab
//   需要人工或上游 readout 给信号；本模块允许 caller 在 manualOverrides 里补齐这部分。
// - AI 归属人类：Co-Authored-By Claude / Codex / AI bot 不被视为单独 contributor，
//   作者归属仍然是 commit author（GitHub handle）。返回字段里只暴露 aiCoAuthorRatio 作为
//   informational 信号，不影响评分。
// - 纯函数 + 类型库：不读 GitHub API、不读 git 仓库。caller 用 `gh api` / `git log`
//   把数据填进 input 后调用本函数。

import type { OperatingSignalQualityEvidence } from "./types";

export type CollectorCommitAuthor = {
  name: string;
  email: string;
  githubLogin?: string | null;
};

export type CollectorCommit = {
  sha: string;
  message: string;
  author: CollectorCommitAuthor;
  coAuthors: { name: string; email: string }[];
  filesChanged: string[];
  additions: number;
  deletions: number;
  isMerge: boolean;
  isRevert: boolean;
};

export type CollectorPullRequest = {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  authorLogin: string;
  commits: CollectorCommit[];
  ciResults?: {
    typecheck: "pass" | "fail" | "unknown";
    lint: "pass" | "fail" | "unknown";
    test: "pass" | "fail" | "unknown";
    boundary: "pass" | "fail" | "unknown";
    build?: "pass" | "fail" | "unknown";
  };
};

export type CollectorInput = {
  commits: CollectorCommit[];
  prs?: CollectorPullRequest[];
  // 显式覆盖：让 caller 把 delivery / signal / collab 的人工证据合并进来。
  manualOverrides?: {
    delivery?: Partial<OperatingSignalQualityEvidence["delivery"]>;
    signal?: Partial<OperatingSignalQualityEvidence["signal"]>;
    collaboration?: Partial<OperatingSignalQualityEvidence["collaboration"]>;
    // noise / prInflation / readiness 也允许覆盖（人工复核之后）
    noise?: Partial<OperatingSignalQualityEvidence["noise"]>;
    prInflation?: Partial<OperatingSignalQualityEvidence["prInflation"]>;
    readiness?: Partial<OperatingSignalQualityEvidence["readiness"]>;
  };
};

export type CollectorAttribution = {
  // 归属到人类 GitHub 账号；AI co-authors 仅作 informational metadata。
  primaryGithubLogin: string | null;
  authorLoginCounts: Record<string, number>;
  aiCoAuthorRatio: number; // 0..1
  detectedAiCoAuthors: string[];
};

export type CollectorResult = {
  evidence: OperatingSignalQualityEvidence;
  attribution: CollectorAttribution;
};

// 启发式 patterns。
const READINESS_PATH_PATTERNS = {
  envConfigured: [/(^|\/)\.env(\.|$)/, /(^|\/)environment\./i],
  cronOrTokenSet: [
    /(^|\/)cron[-_/]/i,
    /scheduler/i,
    /(^|\/)token[-_/]/i,
    /(^|\/)webhook/i,
    /signing[-_]?secret/i,
  ],
  dbMigrated: [/(^|\/)prisma\/(schema|migrations)/i, /\.sql$/i],
  tenantEnabled: [
    /(^|\/)extensions\/[^/]+\/tenant\.manifest\.json$/i,
    /enablement/i,
    /tenant[-_]?manifest/i,
  ],
  initialDataSeeded: [/(^|\/)seed[-_/]/i, /seed.*\.ts$/i, /seed.*\.sql$/i],
};

const AI_CO_AUTHOR_PATTERNS = [
  /claude/i,
  /codex/i,
  /gpt[-_]?\d/i,
  /chat[-_]?gpt/i,
  /openai/i,
  /anthropic/i,
  /copilot/i,
];

const REVERT_REPEAT_PATTERNS = [
  /^revert\b/i,
  /^undo\b/i,
  /^trying again\b/i,
  /^fix typo\b/i,
  /^wip again\b/i,
  /^fix tests again\b/i,
  /^another try\b/i,
];

function detectMatch(path: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(path));
}

function countAiCoAuthors(coAuthors: CollectorCommit["coAuthors"]) {
  return coAuthors.filter((author) =>
    AI_CO_AUTHOR_PATTERNS.some(
      (re) => re.test(author.name) || re.test(author.email),
    ),
  );
}

function detectReadinessSignals(commits: CollectorCommit[]) {
  const seen = {
    envConfigured: false,
    cronOrTokenSet: false,
    dbMigrated: false,
    tenantEnabled: false,
    initialDataSeeded: false,
  };
  for (const commit of commits) {
    for (const path of commit.filesChanged) {
      if (
        !seen.envConfigured &&
        detectMatch(path, READINESS_PATH_PATTERNS.envConfigured)
      ) {
        seen.envConfigured = true;
      }
      if (
        !seen.cronOrTokenSet &&
        detectMatch(path, READINESS_PATH_PATTERNS.cronOrTokenSet)
      ) {
        seen.cronOrTokenSet = true;
      }
      if (
        !seen.dbMigrated &&
        detectMatch(path, READINESS_PATH_PATTERNS.dbMigrated)
      ) {
        seen.dbMigrated = true;
      }
      if (
        !seen.tenantEnabled &&
        detectMatch(path, READINESS_PATH_PATTERNS.tenantEnabled)
      ) {
        seen.tenantEnabled = true;
      }
      if (
        !seen.initialDataSeeded &&
        detectMatch(path, READINESS_PATH_PATTERNS.initialDataSeeded)
      ) {
        seen.initialDataSeeded = true;
      }
    }
  }
  return seen;
}

function detectPrInflation(commits: CollectorCommit[]) {
  let tinyNonCohesiveSliceCount = 0;
  let repeatedNonProgressiveCommitCount = 0;
  let nonMergeCount = 0;
  let totalLines = 0;

  for (const commit of commits) {
    if (commit.isMerge) continue;
    nonMergeCount += 1;
    const lines = commit.additions + commit.deletions;
    totalLines += lines;

    // 过小切片：< 6 lines and 单文件，且不是 docs-only
    const onlyDocs = commit.filesChanged.every((path) =>
      /(^|\/)(docs?|README|CHANGELOG)/i.test(path),
    );
    if (lines > 0 && lines < 6 && commit.filesChanged.length <= 1 && !onlyDocs) {
      tinyNonCohesiveSliceCount += 1;
    }

    // 反复非推进：message 命中 revert / undo / fix typo 类模式，或 isRevert
    const message = commit.message.trim();
    if (
      commit.isRevert ||
      REVERT_REPEAT_PATTERNS.some((re) => re.test(message))
    ) {
      repeatedNonProgressiveCommitCount += 1;
    }
  }

  // commitsForCountSake：>10 non-merge commits + avg lines < 5
  const avgLines = nonMergeCount > 0 ? totalLines / nonMergeCount : 0;
  const commitsForCountSake = nonMergeCount > 10 && avgLines < 5;

  return {
    tinyNonCohesiveSliceCount,
    repeatedNonProgressiveCommitCount,
    commitsForCountSake,
  };
}

function detectNoiseFromCommits(commits: CollectorCommit[]) {
  // 仅从 commit 历史能稳定推断的部分（重复 / 撤销）。
  // misleading / wrongAttribution / invalidReport 必须人工或上游 readout 标注。
  let duplicateSignalCount = 0;
  for (const commit of commits) {
    if (commit.isRevert) {
      duplicateSignalCount += 1;
    }
  }
  return {
    duplicateSignalCount,
    misleadingSignalCount: 0,
    wrongAttributionCount: 0,
    invalidReportCount: 0,
  };
}

function detectDeliveryFromCi(prs: CollectorPullRequest[] | undefined) {
  // 仅当 PR 全部 ci 通过时，给 onlineVerified 一个保守的 hint。
  // 其它 delivery 项（tenantUsable / customerCanTest / operatingPushForward）必须由人工标注。
  const delivery: OperatingSignalQualityEvidence["delivery"] = {
    tenantUsable: false,
    customerCanTest: false,
    onlineVerified: false,
    operatingPushForward: false,
  };
  if (!prs || prs.length === 0) return delivery;
  const allCiPass = prs.every((pr) => {
    const ci = pr.ciResults;
    if (!ci) return false;
    return (
      ci.typecheck === "pass" &&
      ci.lint === "pass" &&
      ci.test === "pass" &&
      ci.boundary === "pass" &&
      (ci.build === "pass" || ci.build === undefined)
    );
  });
  if (allCiPass) {
    delivery.onlineVerified = true;
  }
  return delivery;
}

function buildAttribution(commits: CollectorCommit[]): CollectorAttribution {
  const counts: Record<string, number> = {};
  let totalNonMerge = 0;
  let aiCoAuthored = 0;
  const detectedAi = new Set<string>();
  for (const commit of commits) {
    if (commit.isMerge) continue;
    totalNonMerge += 1;
    const login = commit.author.githubLogin || commit.author.email || commit.author.name;
    counts[login] = (counts[login] ?? 0) + 1;
    const aiCo = countAiCoAuthors(commit.coAuthors);
    if (aiCo.length > 0) {
      aiCoAuthored += 1;
      for (const ai of aiCo) {
        detectedAi.add(ai.name || ai.email);
      }
    }
  }
  let primary: string | null = null;
  let primaryCount = 0;
  for (const [login, count] of Object.entries(counts)) {
    if (count > primaryCount) {
      primaryCount = count;
      primary = login;
    }
  }
  return {
    primaryGithubLogin: primary,
    authorLoginCounts: counts,
    aiCoAuthorRatio: totalNonMerge > 0 ? aiCoAuthored / totalNonMerge : 0,
    detectedAiCoAuthors: [...detectedAi].sort(),
  };
}

function mergeReadiness(
  base: OperatingSignalQualityEvidence["readiness"],
  override?: Partial<OperatingSignalQualityEvidence["readiness"]>,
): OperatingSignalQualityEvidence["readiness"] {
  if (!override) return base;
  return {
    envConfigured: override.envConfigured ?? base.envConfigured,
    cronOrTokenSet: override.cronOrTokenSet ?? base.cronOrTokenSet,
    dbMigrated: override.dbMigrated ?? base.dbMigrated,
    tenantEnabled: override.tenantEnabled ?? base.tenantEnabled,
    initialDataSeeded: override.initialDataSeeded ?? base.initialDataSeeded,
    notes: override.notes ?? base.notes,
  };
}

export function collectOperatingSignalQualityEvidenceFromGitHub(
  input: CollectorInput,
): CollectorResult {
  const readinessFromPaths = detectReadinessSignals(input.commits);
  const prInflationFromCommits = detectPrInflation(input.commits);
  const noiseFromCommits = detectNoiseFromCommits(input.commits);
  const deliveryFromCi = detectDeliveryFromCi(input.prs);

  const overrides = input.manualOverrides ?? {};

  const evidence: OperatingSignalQualityEvidence = {
    delivery: {
      tenantUsable:
        overrides.delivery?.tenantUsable ?? deliveryFromCi.tenantUsable,
      customerCanTest:
        overrides.delivery?.customerCanTest ?? deliveryFromCi.customerCanTest,
      onlineVerified:
        overrides.delivery?.onlineVerified ?? deliveryFromCi.onlineVerified,
      operatingPushForward:
        overrides.delivery?.operatingPushForward ??
        deliveryFromCi.operatingPushForward,
      notes: overrides.delivery?.notes,
    },
    signal: {
      actionable: overrides.signal?.actionable ?? false,
      timely: overrides.signal?.timely ?? false,
      accurate: overrides.signal?.accurate ?? false,
      leadsToReview: overrides.signal?.leadsToReview ?? false,
      notes: overrides.signal?.notes,
    },
    readiness: mergeReadiness(
      {
        envConfigured: readinessFromPaths.envConfigured,
        cronOrTokenSet: readinessFromPaths.cronOrTokenSet,
        dbMigrated: readinessFromPaths.dbMigrated,
        tenantEnabled: readinessFromPaths.tenantEnabled,
        initialDataSeeded: readinessFromPaths.initialDataSeeded,
      },
      overrides.readiness,
    ),
    collaboration: {
      reducedBlockersForOthers:
        overrides.collaboration?.reducedBlockersForOthers ?? false,
      clearHandoff: overrides.collaboration?.clearHandoff ?? false,
      teamSpeedUp: overrides.collaboration?.teamSpeedUp ?? false,
      notes: overrides.collaboration?.notes,
    },
    noise: {
      duplicateSignalCount:
        overrides.noise?.duplicateSignalCount ??
        noiseFromCommits.duplicateSignalCount,
      misleadingSignalCount:
        overrides.noise?.misleadingSignalCount ??
        noiseFromCommits.misleadingSignalCount,
      wrongAttributionCount:
        overrides.noise?.wrongAttributionCount ??
        noiseFromCommits.wrongAttributionCount,
      invalidReportCount:
        overrides.noise?.invalidReportCount ??
        noiseFromCommits.invalidReportCount,
      notes: overrides.noise?.notes,
    },
    prInflation: {
      tinyNonCohesiveSliceCount:
        overrides.prInflation?.tinyNonCohesiveSliceCount ??
        prInflationFromCommits.tinyNonCohesiveSliceCount,
      repeatedNonProgressiveCommitCount:
        overrides.prInflation?.repeatedNonProgressiveCommitCount ??
        prInflationFromCommits.repeatedNonProgressiveCommitCount,
      commitsForCountSake:
        overrides.prInflation?.commitsForCountSake ??
        prInflationFromCommits.commitsForCountSake,
      notes: overrides.prInflation?.notes,
    },
  };

  return {
    evidence,
    attribution: buildAttribution(input.commits),
  };
}

// 暴露给测试和高阶用户。
export const __INTERNALS_FOR_TESTING_ONLY__ = {
  detectReadinessSignals,
  detectPrInflation,
  detectNoiseFromCommits,
  detectDeliveryFromCi,
  buildAttribution,
  AI_CO_AUTHOR_PATTERNS,
  REVERT_REPEAT_PATTERNS,
};
