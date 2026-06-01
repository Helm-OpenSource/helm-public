// Weekly Scorecard — 按贡献者分组的经营信号质量排名。
//
// 用途：把同一时间窗里多个 contributor 的 commits 分桶 → 每桶独立评分 → 输出排名表。
// 服务"AI 原生组织"的经营管理判断：谁的产出有真实经营价值、谁在制造噪声。
//
// 与 single-batch assessment 相比的差异：
// - subject 自动派生为 contributor（每个 author 一份）；
// - 给整个时间窗一个 cohort-level summary（参与人数 / 高价值人数 / harmful 人数 等）。
//
// 边界沿用 Slice B/C/E：
// - 评估快照，非绩效合约，非结算依据；
// - AI 共同署名 ≠ 单独 contributor，归属永远是 GitHub 人类账号；
// - 不持租户字面量，caller 在 reserved-tenant gating 之后调用；
// - 不做自动分配 / 自动外发 / 自动结算。

import { assessOperatingSignalQuality } from "./assess";
import {
  collectOperatingSignalQualityEvidenceFromGitHub,
  type CollectorCommit,
  type CollectorPullRequest,
} from "./collect-from-github";
import type {
  OperatingSignalQualityAssessment,
  OperatingSignalQualityGrade,
} from "./types";

export type WeeklyScorecardContributor = {
  // 优先级：authorLogin (GitHub) > email > name。永远归属 GitHub 人类。
  identityKey: string;
  displayName: string;
  email: string;
  githubLogin: string | null;
};

export type WeeklyScorecardEntry = {
  contributor: WeeklyScorecardContributor;
  commitCount: number;
  aiCoAuthorRatio: number; // 0..1, informational only
  assessment: OperatingSignalQualityAssessment;
  // rank 在 sort 之后由 buildWeeklyScorecard 填入；1-based。
  rank: number;
};

export type WeeklyScorecardCohortSummary = {
  contributorCount: number;
  totalCommits: number;
  highValueCount: number;
  usefulCount: number;
  weakCount: number;
  harmfulCount: number;
  averageScore: number;
};

export type WeeklyScorecard = {
  windowLabel: string;
  cohortSummary: WeeklyScorecardCohortSummary;
  entries: WeeklyScorecardEntry[];
  boundary: {
    reservedOnly: true;
    notAPerformanceContractor: true;
    notAFinancialSettlementInput: true;
    aiOutputAttributedToHumanGithub: true;
  };
};

function resolveContributorIdentity(commit: CollectorCommit): WeeklyScorecardContributor {
  const login = commit.author.githubLogin?.trim() || null;
  const email = commit.author.email?.trim() || "";
  const name = commit.author.name?.trim() || "Unknown";
  const identityKey = login || email || name;
  return {
    identityKey,
    displayName: name,
    email,
    githubLogin: login,
  };
}

function groupCommitsByContributor(commits: CollectorCommit[]) {
  const buckets = new Map<
    string,
    { contributor: WeeklyScorecardContributor; commits: CollectorCommit[] }
  >();
  for (const commit of commits) {
    if (commit.isMerge) continue;
    const identity = resolveContributorIdentity(commit);
    const existing = buckets.get(identity.identityKey);
    if (existing) {
      existing.commits.push(commit);
    } else {
      buckets.set(identity.identityKey, {
        contributor: identity,
        commits: [commit],
      });
    }
  }
  return [...buckets.values()];
}

function indexPrsByCommit(prs: CollectorPullRequest[] | undefined) {
  // 把 PR ciResults 按其 commit sha 索引，方便每桶找到对应的 PR 上下文。
  const index = new Map<string, CollectorPullRequest[]>();
  if (!prs) return index;
  for (const pr of prs) {
    for (const commit of pr.commits) {
      const list = index.get(commit.sha) ?? [];
      list.push(pr);
      index.set(commit.sha, list);
    }
  }
  return index;
}

function gradeBuckets(entries: WeeklyScorecardEntry[]) {
  const counts: Record<OperatingSignalQualityGrade, number> = {
    high_value: 0,
    useful: 0,
    weak: 0,
    harmful: 0,
  };
  let totalScore = 0;
  for (const entry of entries) {
    counts[entry.assessment.grade] += 1;
    totalScore += entry.assessment.scores.totalScore;
  }
  return {
    counts,
    averageScore: entries.length > 0 ? totalScore / entries.length : 0,
  };
}

export function buildWeeklyScorecard(input: {
  commits: CollectorCommit[];
  prs?: CollectorPullRequest[];
  windowLabel: string;
}): WeeklyScorecard {
  const buckets = groupCommitsByContributor(input.commits);
  const prIndex = indexPrsByCommit(input.prs);

  const entries: WeeklyScorecardEntry[] = [];
  for (const bucket of buckets) {
    // 找到这个 contributor 涉及的 PR；可能为空（直接 push 到 main 或本地 commit）。
    const involvedPrs: CollectorPullRequest[] = [];
    const seenPr = new Set<number>();
    for (const commit of bucket.commits) {
      const prs = prIndex.get(commit.sha) ?? [];
      for (const pr of prs) {
        if (!seenPr.has(pr.number)) {
          involvedPrs.push(pr);
          seenPr.add(pr.number);
        }
      }
    }

    const { evidence, attribution } =
      collectOperatingSignalQualityEvidenceFromGitHub({
        commits: bucket.commits,
        prs: involvedPrs.length > 0 ? involvedPrs : undefined,
      });

    const assessment = assessOperatingSignalQuality({
      subject: {
        kind: "contributor",
        label: bucket.contributor.displayName,
        githubHandle: bucket.contributor.githubLogin ?? attribution.primaryGithubLogin,
      },
      evidence,
    });

    entries.push({
      contributor: bucket.contributor,
      commitCount: bucket.commits.length,
      aiCoAuthorRatio: attribution.aiCoAuthorRatio,
      assessment,
      rank: 0, // 占位，下面 sort 后覆写
    });
  }

  // 排序：totalScore 降序；同分时按 commit 数升序（让"少而精"优先）。
  entries.sort((a, b) => {
    if (b.assessment.scores.totalScore !== a.assessment.scores.totalScore) {
      return b.assessment.scores.totalScore - a.assessment.scores.totalScore;
    }
    return a.commitCount - b.commitCount;
  });
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  const totalCommits = input.commits.filter((c) => !c.isMerge).length;
  const { counts, averageScore } = gradeBuckets(entries);

  return {
    windowLabel: input.windowLabel,
    cohortSummary: {
      contributorCount: entries.length,
      totalCommits,
      highValueCount: counts.high_value,
      usefulCount: counts.useful,
      weakCount: counts.weak,
      harmfulCount: counts.harmful,
      averageScore: Number(averageScore.toFixed(2)),
    },
    entries,
    boundary: {
      reservedOnly: true,
      notAPerformanceContractor: true,
      notAFinancialSettlementInput: true,
      aiOutputAttributedToHumanGithub: true,
    },
  };
}

export function formatWeeklyScorecardAsMarkdown(input: {
  scorecard: WeeklyScorecard;
  english: boolean;
}): string {
  const { scorecard, english } = input;
  const lines: string[] = [];
  lines.push(
    english
      ? `### Operating Signal Quality — Weekly Scorecard (${scorecard.windowLabel})`
      : `### 经营信号质量周榜 — ${scorecard.windowLabel}`,
  );
  lines.push("");

  lines.push(
    english
      ? `**Cohort**: ${scorecard.cohortSummary.contributorCount} contributors · ${scorecard.cohortSummary.totalCommits} commits · avg score ${scorecard.cohortSummary.averageScore}`
      : `**整体**：${scorecard.cohortSummary.contributorCount} 位贡献者 · ${scorecard.cohortSummary.totalCommits} 个 commit · 平均分 ${scorecard.cohortSummary.averageScore}`,
  );
  lines.push(
    english
      ? `**Grade breakdown**: high-value ${scorecard.cohortSummary.highValueCount} · useful ${scorecard.cohortSummary.usefulCount} · weak ${scorecard.cohortSummary.weakCount} · harmful ${scorecard.cohortSummary.harmfulCount}`
      : `**评级分布**：高价值 ${scorecard.cohortSummary.highValueCount} · 有用 ${scorecard.cohortSummary.usefulCount} · 偏弱 ${scorecard.cohortSummary.weakCount} · 造成干扰 ${scorecard.cohortSummary.harmfulCount}`,
  );
  lines.push("");

  if (scorecard.entries.length === 0) {
    lines.push(
      english
        ? "_No contributors in this window._"
        : "_本时间窗未匹配到任何贡献者。_",
    );
    lines.push("");
  } else {
    lines.push(
      english
        ? "| Rank | Contributor | GitHub | Commits | Score | Grade | AI co-auth | Top finding |"
        : "| 名次 | 贡献者 | GitHub | Commits | 总分 | 评级 | AI 共署比 | 突出信号 |",
    );
    lines.push(
      english
        ? "| ---: | --- | --- | ---: | ---: | --- | ---: | --- |"
        : "| ---: | --- | --- | ---: | ---: | --- | ---: | --- |",
    );
    for (const entry of scorecard.entries) {
      const grade = formatGradeShort(entry.assessment.grade, english);
      const topFinding = pickTopFinding(entry, english);
      const aiRatio = `${Math.round(entry.aiCoAuthorRatio * 100)}%`;
      lines.push(
        `| ${entry.rank} | ${escapeCell(entry.contributor.displayName)} | ${entry.contributor.githubLogin ?? "—"} | ${entry.commitCount} | ${entry.assessment.scores.totalScore} | ${grade} | ${aiRatio} | ${escapeCell(topFinding)} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    english
      ? "*Reserved-tenant snapshot · not a performance contract · not a financial settlement input · AI output attributed to the human GitHub account.*"
      : "*仅作保留租户内部经营评估快照；不是绩效合约，不是结算依据；AI 共同署名归对应 GitHub 人类账号。*",
  );
  return lines.join("\n");
}

function formatGradeShort(grade: OperatingSignalQualityGrade, english: boolean) {
  switch (grade) {
    case "high_value":
      return english ? "High value" : "高价值";
    case "useful":
      return english ? "Useful" : "有用";
    case "weak":
      return english ? "Weak" : "偏弱";
    case "harmful":
      return english ? "Harmful" : "干扰";
    default: {
      const exhaustive: never = grade;
      return exhaustive;
    }
  }
}

function pickTopFinding(entry: WeeklyScorecardEntry, english: boolean) {
  // 优先：noise findings → 然后 positive signals → 然后 recommendations
  const a = entry.assessment;
  if (a.noiseFindings.length > 0) {
    return english
      ? `Noise: ${a.noiseFindings[0]}`
      : `噪声：${a.noiseFindings[0]}`;
  }
  if (a.positiveSignals.length > 0) {
    return english
      ? `Positive: ${a.positiveSignals[0]}`
      : `正面：${a.positiveSignals[0]}`;
  }
  if (a.recommendations.length > 0) {
    return english
      ? `Next: ${a.recommendations[0]}`
      : `建议：${a.recommendations[0]}`;
  }
  return english ? "—" : "—";
}

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
