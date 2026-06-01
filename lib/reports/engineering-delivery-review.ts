import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { format, subDays } from "date-fns";

const execFileAsync = promisify(execFile);

const FIELD_SEPARATOR = "\u001f";
const LARGE_COMMIT_LINE_THRESHOLD = 700;
const LARGE_COMMIT_FILE_THRESHOLD = 18;
const MAX_CONTRIBUTORS = 6;
const MAX_SUGGESTIONS = 4;
const GIT_BUFFER_BYTES = 12 * 1024 * 1024;
const DEFAULT_REVIEW_DAYS = 28;

type FocusKey =
  | "reports"
  | "operating"
  | "runtime"
  | "governance"
  | "connectors"
  | "docs"
  | "tests"
  | "guardrails"
  | "data"
  | "tooling"
  | "other";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";
type ReviewAvailability = "READY" | "EMPTY" | "UNAVAILABLE";

export type EngineeringDeliveryReviewFreshness = {
  mode: "SNAPSHOT" | "LIVE";
  generatedAt: string | null;
  sourceRevision: string | null;
  stale: boolean;
  note: string;
};

type FocusDefinition = {
  key: FocusKey;
  matcher: (value: string) => boolean;
  label: {
    en: string;
    zh: string;
  };
  aligned: boolean;
  closureSignal: boolean;
};

const FOCUS_DEFINITIONS: FocusDefinition[] = [
  {
    key: "reports",
    matcher: (value) =>
      /(^|\/)(reports|diagnostics|approvals|opportunities)(\/|$)/.test(value),
    label: {
      en: "reports / review surfaces",
      zh: "周报 / 复核面",
    },
    aligned: true,
    closureSignal: false,
  },
  {
    key: "operating",
    matcher: (value) =>
      /(^|\/)(operating|dashboard|customer-success|meetings|inbox)(\/|$)/.test(value),
    label: {
      en: "operating workspace",
      zh: "经营工作区",
    },
    aligned: true,
    closureSignal: false,
  },
  {
    key: "runtime",
    matcher: (value) =>
      /(^|\/)(lib\/helm-v2|lib\/operating-system|lib\/internal-operating-workspace|features\/meetings)(\/|$)/.test(
        value,
      ),
    label: {
      en: "runtime / core logic",
      zh: "运行核心",
    },
    aligned: true,
    closureSignal: false,
  },
  {
    key: "governance",
    matcher: (value) =>
      /(^|\/)(lib\/auth|settings|governance|approval|policies|capability)(\/|$)/.test(
        value,
      ),
    label: {
      en: "governance / auth",
      zh: "治理与登录",
    },
    aligned: true,
    closureSignal: false,
  },
  {
    key: "connectors",
    matcher: (value) =>
      /(^|\/)(imports|connectors|capture)(\/|$)/.test(value),
    label: {
      en: "connectors / imports",
      zh: "接入与导入",
    },
    aligned: true,
    closureSignal: false,
  },
  {
    key: "docs",
    matcher: (value) =>
      value.endsWith(".md") ||
      value === "readme.md" ||
      value === "plans.md" ||
      value.startsWith("docs/") ||
      value === "agents.md" ||
      value === "working-context.md" ||
      value === "design.md",
    label: {
      en: "docs / baseline",
      zh: "文档与基线",
    },
    aligned: true,
    closureSignal: true,
  },
  {
    key: "tests",
    matcher: (value) =>
      value.startsWith("tests/") ||
      value.startsWith("evals/") ||
      value.includes(".test.") ||
      value.includes(".spec."),
    label: {
      en: "tests / regression",
      zh: "测试与回归",
    },
    aligned: true,
    closureSignal: true,
  },
  {
    key: "guardrails",
    matcher: (value) =>
      value.startsWith("scripts/") &&
      /(check|self-check|validate|guard|hook|benchmark)/.test(value),
    label: {
      en: "guardrails / self-check",
      zh: "守卫与自检",
    },
    aligned: true,
    closureSignal: true,
  },
  {
    key: "data",
    matcher: (value) =>
      value.startsWith("prisma/") ||
      value.startsWith("data/") ||
      value.includes("schema.prisma"),
    label: {
      en: "data / schema",
      zh: "数据与模型",
    },
    aligned: true,
    closureSignal: false,
  },
  {
    key: "tooling",
    matcher: (value) =>
      value.startsWith(".github/") ||
      value.startsWith(".codex/") ||
      value === "package.json" ||
      value === "package-lock.json" ||
      value.endsWith(".config.ts") ||
      value.endsWith(".config.mjs"),
    label: {
      en: "tooling / release",
      zh: "工具与发布",
    },
    aligned: false,
    closureSignal: false,
  },
];

const IMPLEMENTATION_FOCUS_KEYS = new Set<FocusKey>([
  "reports",
  "operating",
  "runtime",
  "governance",
  "connectors",
  "data",
]);

type GitFileStat = {
  path: string;
  additions: number;
  deletions: number;
  changedLines: number;
  binary: boolean;
  focusKey: FocusKey;
};

type GitCommitRecord = {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  files: GitFileStat[];
};

type ContributorAnalysis = {
  name: string;
  email: string;
  commits: number;
  activeDays: number;
  filesTouched: number;
  changedLines: number;
  commitShare: number;
  changedLineShare: number;
  docsCommitRate: number;
  testsCommitRate: number;
  guardrailCommitRate: number;
  closureCommitRate: number;
  largeCommitRate: number;
  repeatedFileRate: number;
  overlapFileCount: number;
  focusLabels: string[];
  latestSubject: string;
  contentSummary: string;
  quantityJudgement: string;
  qualityJudgement: string;
  directionJudgement: string;
  deliveryJudgement: string;
  workingStyle: string;
  suggestion: string;
  badgeTone: BadgeTone;
  metricCards: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
};

export type EngineeringDeliveryReview = {
  availability: ReviewAvailability;
  repoLabel: string;
  windowLabel: string;
  headline: string;
  summary: string;
  sourceNote: string;
  boundaryNote: string;
  snapshot: {
    objectState: string;
    blocker: string;
    pendingDecision: string;
    nextAction: string;
  };
  connections: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  contributors: ContributorAnalysis[];
  collaboration: {
    summary: string;
    hotspots: string[];
    risks: string[];
    overlapPairs: Array<{
      label: string;
      detail: string;
    }>;
  };
  suggestions: Array<{
    title: string;
    body: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
  freshness?: EngineeringDeliveryReviewFreshness;
};

export async function getEngineeringDeliveryReview(input?: {
  days?: number;
  english?: boolean;
  cwd?: string;
  revision?: string;
}): Promise<EngineeringDeliveryReview> {
  const days = input?.days ?? DEFAULT_REVIEW_DAYS;
  const english = input?.english ?? false;
  const cwd = input?.cwd ?? process.cwd();
  const revision = input?.revision?.trim();

  try {
    const repoRoot = (await runGit(["rev-parse", "--show-toplevel"], cwd)).trim();
    const since = format(subDays(new Date(), days), "yyyy-MM-dd");
    const sourceRevision = (await runGit(["-C", repoRoot, "rev-parse", revision || "HEAD"], cwd)).trim();
    const raw = await runGit(
      [
        "-C",
        repoRoot,
        "log",
        "--use-mailmap",
        "--no-merges",
        `--since=${since}`,
        "--date=short",
        `--format=commit${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%aN${FIELD_SEPARATOR}%aE${FIELD_SEPARATOR}%ad${FIELD_SEPARATOR}%s`,
        "--numstat",
        ...(revision ? [revision] : []),
        "--",
        ".",
      ],
      cwd,
    );

    const commits = parseGitHistoryLog(raw);

    if (!commits.length) {
      const emptyReview = buildEmptyEngineeringDeliveryReview({
        english,
        repoLabel: path.basename(repoRoot),
        days,
      });
      emptyReview.freshness = buildLiveFreshness({
        english,
        sourceRevision,
      });
      return emptyReview;
    }

    const review = buildEngineeringDeliveryReview({
      repoLabel: path.basename(repoRoot),
      days,
      english,
      commits,
    });
    review.freshness = buildLiveFreshness({
      english,
      sourceRevision,
    });
    return review;
  } catch {
    const unavailableReview = buildUnavailableEngineeringDeliveryReview({
      english: input?.english ?? false,
      repoLabel: path.basename(cwd),
      days,
    });
    unavailableReview.freshness = buildLiveFreshness({
      english: input?.english ?? false,
      sourceRevision: null,
    });
    return unavailableReview;
  }
}

async function runGit(args: string[], cwd: string) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: GIT_BUFFER_BYTES,
  });

  return stdout.trimEnd();
}

export function parseGitHistoryLog(raw: string) {
  const commits: GitCommitRecord[] = [];
  let current: GitCommitRecord | null = null;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;

    if (line.startsWith(`commit${FIELD_SEPARATOR}`)) {
      if (current) {
        commits.push(current);
      }

      const [, hash, authorName, authorEmail, date, subject] = line.split(FIELD_SEPARATOR);
      current = {
        hash,
        authorName,
        authorEmail,
        date,
        subject,
        files: [],
      };
      continue;
    }

    if (!current) continue;

    const [additionsRaw, deletionsRaw, filePath] = line.split("\t");
    if (!filePath) continue;

    const binary = additionsRaw === "-" || deletionsRaw === "-";
    const additions = binary ? 0 : Number(additionsRaw);
    const deletions = binary ? 0 : Number(deletionsRaw);

    current.files.push({
      path: filePath,
      additions,
      deletions,
      changedLines: additions + deletions,
      binary,
      focusKey: resolveFocusKey(filePath),
    });
  }

  if (current) {
    commits.push(current);
  }

  return commits.filter((commit) => commit.hash && commit.authorName);
}

export function buildEngineeringDeliveryReview(input: {
  repoLabel: string;
  days: number;
  english?: boolean;
  commits: GitCommitRecord[];
}): EngineeringDeliveryReview {
  const english = input.english ?? false;
  const windowLabel = english ? `Last ${input.days} days` : `最近 ${input.days} 天`;
  const totalCommits = input.commits.length;
  const teamFiles = input.commits.flatMap((commit) => commit.files);
  const totalChangedLines = input.commits.reduce(
    (sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.changedLines, 0),
    0,
  );
  const uniquePaths = new Set(teamFiles.map((file) => file.path));
  const fileAuthors = buildFileAuthorsMap(input.commits);
  const focusCounts = countFocuses(teamFiles);
  const topTeamFocuses = sortCounts(focusCounts)
    .slice(0, 3)
    .map(([key]) => getFocusLabel(key as FocusKey, english));
  const contributorGroups = groupCommitsByContributor(input.commits);
  const allContributors = Array.from(contributorGroups.entries())
    .map(([authorKey, commits]) =>
      buildContributorAnalysis({
        authorKey,
        commits,
        totalCommits,
        totalChangedLines,
        fileAuthors,
        english,
      }),
    )
    .sort((left, right) => {
      if (right.commits !== left.commits) return right.commits - left.commits;
      return right.changedLines - left.changedLines;
    });
  const contributors = allContributors.slice(0, MAX_CONTRIBUTORS);

  const activeContributorCount = allContributors.length;
  const largestCommitShare = allContributors[0]?.commitShare ?? 0;
  const largestLineShare = allContributors[0]?.changedLineShare ?? 0;
  const averageClosureRate =
    allContributors.reduce((sum, contributor) => sum + contributor.closureCommitRate, 0) /
    Math.max(allContributors.length, 1);
  const averageLargeCommitRate =
    allContributors.reduce((sum, contributor) => sum + contributor.largeCommitRate, 0) /
    Math.max(allContributors.length, 1);
  const alignedFocusRatio =
    teamFiles.length > 0
      ? teamFiles.filter((file) => isAlignedFocus(file.focusKey)).length / teamFiles.length
      : 0;
  const overlapPairs = buildOverlapPairs(fileAuthors, english);
  const crossOwnedCriticalAreas = buildCrossOwnedCriticalAreas(fileAuthors, english);

  const directionAligned = alignedFocusRatio >= 0.7;
  const centralized = largestCommitShare >= 0.58 || largestLineShare >= 0.68;
  const closureWeak = averageClosureRate < 0.28;
  const batched = averageLargeCommitRate >= 0.38;

  const headline = english
    ? "Engineering delivery should show direction, closure, and collaboration rather than raw commit volume."
    : "工程交付应该先显示方向、闭环和协同，而不是只看提交数。";
  const summary = english
    ? `The current repository review covers ${activeContributorCount} active contributors, ${totalCommits} non-merge commits, and ${uniquePaths.size} touched files across ${windowLabel.toLowerCase()}. The dominant work stays around ${joinList(topTeamFocuses, english)}.`
    : `当前仓库复盘覆盖 ${activeContributorCount} 位活跃贡献者，已经形成${describeDeliveryVolume(totalCommits, false)}和${describeTouchScope(uniquePaths.size, false)}。团队主要把工作落在 ${joinList(topTeamFocuses, english)}。`;
  const sourceNote = english
    ? "Source: current repository git history with .mailmap author mapping applied."
    : "数据源：当前仓库 Git 历史，并应用 `.mailmap` 作者映射。";
  const boundaryNote = english
    ? "This is an internal management readout only. It does not yet include live GitHub PR reviews, CI status, issue flow, or official performance scoring."
    : "这只是内部管理判断层。当前还不包含代码托管平台的正式合并评审、自动化检查状态、事项流转或正式绩效裁定。";

  const collaborationHotspots = overlapPairs
    .slice(0, 3)
    .map((item) => `${item.label} ${item.detail}`);
  const collaborationRisks = [
    centralized
      ? english
        ? `${allContributors[0]?.name ?? "The lead contributor"} still carries most throughput, so review and integration risk remain concentrated.`
        : `${allContributors[0]?.name ?? "主力作者"} 当前仍承接大部分吞吐，复核与集成风险明显中心化。`
      : english
        ? "No single contributor dominates the full window, so throughput is not fully locked to one person."
        : "当前没有单一作者完全垄断整个窗口，吞吐没有被完全锁在一个人身上。",
    closureWeak
      ? english
        ? "Docs / tests / guardrail closure is still thinner than implementation velocity, so sufficiency should stay downgraded."
        : "文档、测试和守卫闭环仍然薄于实现速度，所以交付充分度需要继续降级表达。"
      : english
        ? "Implementation is usually accompanied by docs, tests, or guardrail work, so closure signals are visible."
        : "实现通常能伴随文档、测试或守卫收口，所以闭环信号是可见的。",
    crossOwnedCriticalAreas.length
      ? english
        ? `${crossOwnedCriticalAreas[0]} already has multi-author overlap, so ownership and review boundaries need to stay explicit.`
        : `${crossOwnedCriticalAreas[0]} 已出现多作者重叠，职责归属和复核边界要继续显式。`
      : english
        ? "Critical paths are still mostly single-owner, so the main risk is bus factor rather than conflict noise."
        : "关键路径当前仍以单人负责为主，主要风险是关键人依赖，而不是冲突噪声。",
  ];

  const suggestions = buildTeamSuggestions({
    english,
    contributors,
    centralized,
    closureWeak,
    batched,
    overlapPairs,
  });

  const blocker = centralized
    ? english
      ? `${allContributors[0]?.name ?? "The top contributor"} still owns too much of the throughput, which makes direction review and regression closure depend on a narrow lane.`
      : `${allContributors[0]?.name ?? "主力作者"} 仍然承接过多吞吐，导致方向判断和回归收口都压在一条很窄的通道上。`
    : closureWeak
      ? english
        ? "Implementation speed is ahead of closure evidence, so delivery sufficiency should stay downgraded."
        : "实现速度领先于闭环证据，所以交付充分度必须继续降级。"
      : batched
        ? english
          ? "Batch size is still high in a few slices, so signal quality is harder to review than it should be."
          : "部分切片的批量规模仍然偏大，导致信号比应有状态更难复核。"
        : english
          ? "The main remaining pressure is coordinated ownership rather than lack of movement."
          : "当前主要剩余压力更像协同职责归属，而不是没有推进。";
  const pendingDecision = suggestions[0]?.title ??
    (english
      ? "Decide which critical path should gain a second owner next."
      : "决定下一条关键路径先补第二负责人。");
  const nextAction = suggestions[0]?.body ??
    (english
      ? "Use the contributor cards to rebalance ownership before widening the next batch."
      : "先用下面的贡献者卡片重分职责，再扩大下一批工作。");

  return {
    availability: "READY",
    repoLabel: input.repoLabel,
    windowLabel,
    headline,
    summary,
    sourceNote,
    boundaryNote,
    snapshot: {
      objectState: english
        ? `${activeContributorCount} contributors · ${totalCommits} commits · ${uniquePaths.size} files`
        : `${activeContributorCount} 位贡献者 · ${describeDeliveryVolume(totalCommits, false)} · ${describeTouchScope(uniquePaths.size, false)}`,
      blocker,
      pendingDecision,
      nextAction,
    },
    connections: [
      {
        label: english ? "Direction" : "方向",
        value: directionAligned
          ? english
            ? "Mostly aligned"
            : "基本对齐"
          : english
            ? "Mixed"
            : "出现偏混",
        description: directionAligned
          ? english
            ? `The dominant work stays in ${joinList(topTeamFocuses, english)} and still follows current-main priorities.`
            : `主要工作仍集中在 ${joinList(topTeamFocuses, english)}，与当前主线优先级基本一致。`
          : english
            ? "A meaningful portion of change is drifting into tooling-only or low-context areas, so product priority clarity should be re-asserted."
            : "有一部分改动开始偏向 tooling-only 或低上下文区域，需要重新强调产品优先级。",
      },
      {
        label: english ? "Closure" : "闭环",
        value: closureWeak
          ? english
            ? "Needs next layer"
            : "仍需下一层"
          : english
            ? "Visible"
            : "基本可见",
        description: english
          ? `${Math.round(averageClosureRate * 100)}% of contributor activity couples implementation with docs, tests, or guardrails.`
          : `${describeClosureCoverage(averageClosureRate, false)}的贡献者活动会把实现和文档、测试或守卫一起推进。`,
      },
      {
        label: english ? "Ownership pressure" : "职责压力",
        value: centralized
          ? english
            ? "Concentrated"
            : "中心化"
          : english
            ? "Shared"
            : "相对分散",
        description: english
          ? `${allContributors[0]?.name ?? "The top contributor"} carries ${Math.round(largestCommitShare * 100)}% of commits in this window.`
          : `${allContributors[0]?.name ?? "主力作者"} 在当前窗口承接了大部分提交，复核压力需要显式分摊。`,
      },
      {
        label: english ? "Collaboration" : "协同",
        value: overlapPairs.length
          ? english
            ? "Observable"
            : "已有重叠"
          : english
            ? "Mostly siloed"
            : "仍偏孤立",
        description: overlapPairs.length
          ? `${overlapPairs[0].label} ${overlapPairs[0].detail}`
          : english
            ? "Most files remain single-author, so bus factor is a bigger risk than merge friction."
            : "大部分文件仍是单作者触达，关键人依赖风险高于合并冲突。",
      },
    ],
    contributors,
    collaboration: {
      summary: english
        ? "Use this block to judge whether contributor output is aligned, sufficiently closed, and coordinated across critical paths."
        : "这块用来判断贡献者输出是否方向对齐、闭环足够，以及关键路径协同是否站得住。",
      hotspots: collaborationHotspots.length
        ? collaborationHotspots
        : [
            english
              ? "No strong overlap hotspot is visible yet."
              : "当前还没有特别强的重叠热点。",
          ],
      risks: collaborationRisks,
      overlapPairs,
    },
    suggestions,
  };
}

function buildContributorAnalysis(input: {
  authorKey: string;
  commits: GitCommitRecord[];
  totalCommits: number;
  totalChangedLines: number;
  fileAuthors: Map<string, Set<string>>;
  english: boolean;
}): ContributorAnalysis {
  const english = input.english;
  const sortedCommits = [...input.commits].sort((left, right) => right.date.localeCompare(left.date));
  const files = sortedCommits.flatMap((commit) => commit.files);
  const uniqueFiles = new Set(files.map((file) => file.path));
  const activeDays = new Set(sortedCommits.map((commit) => commit.date));
  const changedLines = files.reduce((sum, file) => sum + file.changedLines, 0);
  const docsCommitRate = ratio(
    sortedCommits.filter((commit) => commit.files.some((file) => file.focusKey === "docs")).length,
    sortedCommits.length,
  );
  const testsCommitRate = ratio(
    sortedCommits.filter((commit) => commit.files.some((file) => file.focusKey === "tests")).length,
    sortedCommits.length,
  );
  const guardrailCommitRate = ratio(
    sortedCommits.filter((commit) => commit.files.some((file) => file.focusKey === "guardrails")).length,
    sortedCommits.length,
  );
  const closureCommitRate = ratio(
    sortedCommits.filter((commit) => commitTouchesClosure(commit)).length,
    sortedCommits.length,
  );
  const largeCommitRate = ratio(
    sortedCommits.filter((commit) => isLargeCommit(commit)).length,
    sortedCommits.length,
  );
  const repeatedFileRate = ratio(
    countRepeatedFiles(files.map((file) => file.path)),
    uniqueFiles.size,
  );
  const overlapFileCount = Array.from(uniqueFiles).filter(
    (filePath) => (input.fileAuthors.get(filePath)?.size ?? 0) > 1,
  ).length;
  const focusCounts = countFocuses(files);
  const topFocusKeys = sortCounts(focusCounts)
    .slice(0, 3)
    .map(([key]) => key as FocusKey);
  const focusLabels = topFocusKeys.map((key) => getFocusLabel(key, english));
  const alignedFocusRatio =
    files.length > 0
      ? files.filter((file) => isAlignedFocus(file.focusKey)).length / files.length
      : 0;
  const commitShare = ratio(sortedCommits.length, input.totalCommits);
  const changedLineShare = ratio(changedLines, input.totalChangedLines);
  const latestSubject = buildLatestActionLabel(sortedCommits[0], english);
  const name = sortedCommits[0]?.authorName ?? input.authorKey;
  const email = sortedCommits[0]?.authorEmail ?? "";

  const contentSummary = english
    ? `Recent work is concentrated in ${joinList(focusLabels, english)}.`
    : `最近的工作主要集中在 ${joinList(focusLabels, english)}。`;
  const quantityJudgement =
    commitShare >= 0.4 || changedLineShare >= 0.45
      ? english
        ? "Main delivery lane in the current window."
        : "当前窗口里的主力交付通道。"
      : commitShare >= 0.15 || sortedCommits.length >= 8
        ? english
          ? "Stable contributor with visible throughput."
          : "稳定推进，吞吐清晰可见。"
        : english
          ? "Supportive slice with narrower throughput."
          : "更偏补位型，吞吐较窄。";
  const qualityJudgement =
    closureCommitRate >= 0.4 && largeCommitRate < 0.35
      ? english
        ? "Quality signals are comparatively steady from commit history."
        : "从提交历史看，质量信号相对稳定。"
      : closureCommitRate < 0.25 || largeCommitRate >= 0.5
        ? english
          ? "Quality closure is still thinner than delivery speed."
          : "质量闭环仍然薄于交付速度。"
        : english
          ? "Quality signals are visible, but not yet strong enough to overstate."
          : "质量信号已经可见，但还不足以过度乐观。";
  const directionJudgement =
    alignedFocusRatio >= 0.7
      ? english
        ? "Work direction stays aligned with current-main priorities."
        : "工作方向与当前主线优先级基本对齐。"
      : english
        ? "Work direction is mixed and needs tighter priority framing."
        : "工作方向开始出现混杂，需要更紧的优先级收敛。";
  const deliveryJudgement =
    closureCommitRate >= 0.35 || (docsCommitRate + testsCommitRate + guardrailCommitRate >= 0.85)
      ? english
        ? "Delivery is reasonably complete for a narrow slice."
        : "对一个窄切片来说，交付相对完整。"
      : sortedCommits.length >= 3
        ? english
          ? "Delivery is formed, but still needs the next closure layer."
          : "交付已经成形，但仍需下一层闭环。"
        : english
          ? "Signal is still too thin to call delivery sufficient."
          : "当前信号还偏薄，不足以下结论说交付已经足够。";
  const workingStyle =
    largeCommitRate >= 0.45
      ? english
        ? "Works in large batches; review cost rises quickly."
        : "更偏大批量推进，复核成本会升得很快。"
      : overlapFileCount > 0
        ? english
          ? "Owns a clear slice, but already intersects with shared paths."
          : "承担清晰切片，但已经进入共享路径重叠区。"
        : english
          ? "Moves in a focused lane with limited overlap."
          : "推进路径较聚焦，和他人的重叠有限。";
  const suggestion =
    closureCommitRate < 0.25
      ? english
        ? "Pair the next implementation commit with docs, tests, or self-check updates so the slice stops looking partially closed."
        : "下一次实现提交最好同步补文档、测试或自检，避免这条线继续像“只做了一半”。"
      : overlapFileCount > 0
        ? english
          ? "Make review ownership explicit on the shared files before the next batch lands."
          : "在下一批提交落下前，先把共享文件上的复核责任说清楚。"
        : largeCommitRate >= 0.45
          ? english
            ? "Split the next batch into narrower slices so the team can review intent, risk, and closure separately."
            : "下一批最好拆成更窄的切片，让团队能把意图、风险和闭环分开复核。"
          : english
            ? "Keep the current lane narrow and keep closure evidence visible."
            : "继续保持窄路径推进，并把闭环证据留在前台。";

  const badgeTone: BadgeTone =
    closureCommitRate < 0.25 || largeCommitRate >= 0.55
      ? "warning"
      : commitShare >= 0.35 || closureCommitRate >= 0.4
        ? "success"
        : "info";

  return {
    name,
    email,
    commits: sortedCommits.length,
    activeDays: activeDays.size,
    filesTouched: uniqueFiles.size,
    changedLines,
    commitShare,
    changedLineShare,
    docsCommitRate,
    testsCommitRate,
    guardrailCommitRate,
    closureCommitRate,
    largeCommitRate,
    repeatedFileRate,
    overlapFileCount,
    focusLabels,
    latestSubject,
    contentSummary,
    quantityJudgement,
    qualityJudgement,
    directionJudgement,
    deliveryJudgement,
    workingStyle,
    suggestion,
    badgeTone,
    metricCards: [
      {
        label: english ? "Quantity" : "数量",
        value: english
          ? `${sortedCommits.length} commits · ${uniqueFiles.size} files`
          : `${sortedCommits.length} 提交 · ${uniqueFiles.size} 文件`,
        detail: english
          ? `${activeDays.size} active days · ${changedLines} changed lines`
          : `${activeDays.size} 个活跃日 · ${changedLines} 行改动`,
      },
      {
        label: english ? "Closure" : "闭环",
        value: english
          ? `${Math.round(closureCommitRate * 100)}% coupled`
          : `${Math.round(closureCommitRate * 100)}% 有闭环`,
        detail: english
          ? `docs ${Math.round(docsCommitRate * 100)}% · tests ${Math.round(testsCommitRate * 100)}% · guardrails ${Math.round(guardrailCommitRate * 100)}%`
          : `文档 ${Math.round(docsCommitRate * 100)}% · 测试 ${Math.round(testsCommitRate * 100)}% · 守卫 ${Math.round(guardrailCommitRate * 100)}%`,
      },
      {
        label: english ? "Working mode" : "工作方式",
        value: english
          ? `${Math.round(largeCommitRate * 100)}% large batches`
          : `${Math.round(largeCommitRate * 100)}% 大批量提交`,
        detail: english
          ? `${Math.round(repeatedFileRate * 100)}% repeat-file ratio · ${overlapFileCount} shared files`
          : `${Math.round(repeatedFileRate * 100)}% 重复文件率 · ${overlapFileCount} 个共享文件`,
      },
    ],
  };
}

function buildFileAuthorsMap(commits: GitCommitRecord[]) {
  return commits.reduce((acc, commit) => {
    const authorKey = buildAuthorKey(commit.authorName, commit.authorEmail);

    for (const file of commit.files) {
      const authors = acc.get(file.path) ?? new Set<string>();
      authors.add(authorKey);
      acc.set(file.path, authors);
    }

    return acc;
  }, new Map<string, Set<string>>());
}

function groupCommitsByContributor(commits: GitCommitRecord[]) {
  return commits.reduce((acc, commit) => {
    const authorKey = buildAuthorKey(commit.authorName, commit.authorEmail);
    const current = acc.get(authorKey) ?? [];
    current.push(commit);
    acc.set(authorKey, current);
    return acc;
  }, new Map<string, GitCommitRecord[]>());
}

function buildLatestActionLabel(commit: GitCommitRecord | undefined, english: boolean) {
  if (!commit) {
    return english ? "No recent commit subject" : "暂无最近可见动作";
  }

  if (english) {
    return commit.subject;
  }

  const parsed = parseConventionalSubject(commit.subject);
  const action = translateCommitType(parsed?.type);
  const target =
    translateSubjectScope(parsed?.scope) ?? translateSubjectTarget(commit.subject, commit.files);

  return target ? `${action}：${target}` : action;
}

function parseConventionalSubject(subject: string) {
  const match = subject.match(/^([a-z]+)(?:\(([^)]+)\))?:\s*(.+)$/i);
  if (!match) return null;

  return {
    type: match[1].toLowerCase(),
    scope: match[2]?.toLowerCase(),
    body: match[3],
  };
}

function translateCommitType(type: string | undefined) {
  switch (type) {
    case "feat":
      return "新增或强化";
    case "fix":
      return "修复";
    case "docs":
      return "补齐文档";
    case "test":
    case "tests":
      return "补齐测试";
    case "refactor":
      return "收敛结构";
    case "perf":
      return "优化性能";
    case "style":
      return "优化界面表达";
    case "build":
    case "ci":
      return "维护构建自动化";
    case "chore":
      return "维护配置";
    default:
      return "更新";
  }
}

function translateSubjectScope(scope: string | undefined) {
  if (!scope) return null;

  if (/(memory|briefing|facts?|commitments?|blockers?)/.test(scope)) {
    return "结构化记忆与经营信号";
  }
  if (/(report|reports|weekly)/.test(scope)) {
    return "周报复核面";
  }
  if (/(approval|approvals)/.test(scope)) {
    return "审批复核面";
  }
  if (/(dashboard|workspace|operating|home)/.test(scope)) {
    return "经营工作区";
  }
  if (/(auth|login|membership|invite)/.test(scope)) {
    return "登录与成员边界";
  }
  if (/(runtime|core|system)/.test(scope)) {
    return "运行核心";
  }
  if (/(docs|baseline|plan)/.test(scope)) {
    return "文档与基线";
  }
  if (/(test|regression|quality|guard)/.test(scope)) {
    return "测试、守卫与回归";
  }

  return null;
}

function translateSubjectTarget(subject: string, files: GitFileStat[]) {
  const lowerSubject = subject.toLowerCase();
  const subjectTarget =
    translateSubjectScope(lowerSubject.match(/\(([^)]+)\)/)?.[1]?.toLowerCase()) ??
    translateSubjectScope(lowerSubject);
  if (subjectTarget) return subjectTarget;

  const focusCounts = countFocuses(files);
  const focusKey = sortCounts(focusCounts)[0]?.[0] as FocusKey | undefined;
  if (!focusKey) return null;

  return getFocusLabel(focusKey, false);
}

function buildOverlapPairs(fileAuthors: Map<string, Set<string>>, english: boolean) {
  const pairCounts = new Map<string, { authors: string[]; count: number; focusKeys: FocusKey[] }>();

  for (const [filePath, authors] of fileAuthors.entries()) {
    if (authors.size < 2) continue;

    const sortedAuthors = Array.from(authors).sort();
    for (let index = 0; index < sortedAuthors.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < sortedAuthors.length; nextIndex += 1) {
        const pair = [sortedAuthors[index], sortedAuthors[nextIndex]];
        const pairKey = pair.join("::");
        const current = pairCounts.get(pairKey) ?? { authors: pair, count: 0, focusKeys: [] };
        current.count += 1;
        current.focusKeys.push(resolveFocusKey(filePath));
        pairCounts.set(pairKey, current);
      }
    }
  }

  return Array.from(pairCounts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 4)
    .map((pair) => {
      const authorLabels = pair.authors.map(getAuthorDisplayName);
      const focusLabel = getFocusLabel(
        sortCounts(countFocusKeys(pair.focusKeys))[0]?.[0] as FocusKey,
        english,
      );

      return {
        label: authorLabels.join(" + "),
        detail: english
          ? `share ${pair.count} files, mainly around ${focusLabel}.`
          : `在共享路径上${describeOverlapIntensity(pair.count, false)}，主要集中在 ${focusLabel}。`,
      };
    });
}

function describeClosureCoverage(rate: number, english: boolean) {
  if (english) {
    if (rate >= 0.6) return "Most";
    if (rate >= 0.4) return "Nearly half";
    if (rate >= 0.25) return "Some";
    return "A small portion";
  }

  if (rate >= 0.6) return "多数";
  if (rate >= 0.4) return "接近半数";
  if (rate >= 0.25) return "一部分";
  return "少数";
}

function describeDeliveryVolume(totalCommits: number, english: boolean) {
  if (english) {
    if (totalCommits >= 500) return "high-volume delivery";
    if (totalCommits >= 120) return "active delivery";
    if (totalCommits >= 30) return "visible delivery";
    return "light delivery";
  }

  if (totalCommits >= 500) return "高频交付窗口";
  if (totalCommits >= 120) return "活跃交付窗口";
  if (totalCommits >= 30) return "可见交付窗口";
  return "轻量交付窗口";
}

function describeTouchScope(fileCount: number, english: boolean) {
  if (english) {
    if (fileCount >= 1000) return "broad file reach";
    if (fileCount >= 300) return "multi-surface file reach";
    if (fileCount >= 80) return "focused file reach";
    return "narrow file reach";
  }

  if (fileCount >= 1000) return "大范围触达";
  if (fileCount >= 300) return "多页面触达";
  if (fileCount >= 80) return "聚焦触达";
  return "窄范围触达";
}

function describeOverlapIntensity(fileCount: number, english: boolean) {
  if (english) {
    if (fileCount >= 100) return "heavy overlap";
    if (fileCount >= 50) return "clear overlap";
    if (fileCount >= 20) return "visible overlap";
    return "light overlap";
  }

  if (fileCount >= 100) return "高频重叠";
  if (fileCount >= 50) return "明显重叠";
  if (fileCount >= 20) return "可见重叠";
  return "轻量重叠";
}

function buildCrossOwnedCriticalAreas(fileAuthors: Map<string, Set<string>>, english: boolean) {
  const criticalFocusKeys = new Set<FocusKey>([
    "reports",
    "operating",
    "runtime",
    "governance",
    "connectors",
    "data",
  ]);
  const counts = new Map<FocusKey, number>();

  for (const [filePath, authors] of fileAuthors.entries()) {
    if (authors.size < 2) continue;
    const focusKey = resolveFocusKey(filePath);
    if (!criticalFocusKeys.has(focusKey)) continue;
    counts.set(focusKey, (counts.get(focusKey) ?? 0) + 1);
  }

  return sortCounts(counts)
    .slice(0, 3)
    .map(([key]) => getFocusLabel(key as FocusKey, english));
}

function buildTeamSuggestions(input: {
  english: boolean;
  contributors: ContributorAnalysis[];
  centralized: boolean;
  closureWeak: boolean;
  batched: boolean;
  overlapPairs: Array<{ label: string; detail: string }>;
}) {
  const suggestions: EngineeringDeliveryReview["suggestions"] = [];

  if (input.centralized) {
    suggestions.push({
      title: input.english
        ? "Split a second owner into the dominant delivery lane"
        : "给主力交付路径补第二负责人",
      body: input.english
        ? `${input.contributors[0]?.name ?? "The top contributor"} currently carries too much throughput. The next critical slice should have an explicit second owner and reviewer.`
        : `${input.contributors[0]?.name ?? "主力作者"} 当前承接了过多吞吐。下一条关键切片应明确补第二负责人和复核人。`,
      priority: "HIGH",
    });
  }

  if (input.closureWeak) {
    suggestions.push({
      title: input.english
        ? "Make docs / tests / self-check part of the default delivery bar"
        : "把文档、测试和自检提升为默认交付门槛",
      body: input.english
        ? "Current output is faster than closure evidence. High-risk changes should not be counted as sufficient unless they also ship the matching closure layer or an explicit exemption."
        : "当前产出速度快于闭环证据。高风险改动如果没有对应的文档、测试、自检或明确豁免，不应算作“交付充分”。",
      priority: "HIGH",
    });
  }

  if (input.batched) {
    suggestions.push({
      title: input.english
        ? "Reduce batch size before the next review-heavy slice"
        : "在下一轮复核密集切片前先降低批量规模",
      body: input.english
        ? "Large commits are still common enough to blur direction, risk, and closure. Split the next slice so those signals can be reviewed independently."
        : "大批量提交仍然足够常见，容易把方向、风险和闭环混在一起。下一轮最好拆小，让这些信号能分别复核。",
      priority: "MEDIUM",
    });
  }

  if (input.overlapPairs.length) {
    suggestions.push({
      title: input.english
        ? "Turn shared-file overlap into explicit review lanes"
        : "把共享文件重叠收成明确的复核路径",
      body: input.english
        ? `${input.overlapPairs[0].label} already overlap on the same files. Capture those lanes as explicit review ownership instead of relying on ad hoc coordination.`
        : `${input.overlapPairs[0].label} 已经开始在同一批文件上重叠。最好把这条线收成明确的复核责任，而不是继续靠临时协同。`,
      priority: "MEDIUM",
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      title: input.english
        ? "Keep the current lanes narrow and observable"
        : "继续保持当前路径的窄和可观测",
      body: input.english
        ? "Direction is reasonably aligned right now. The main job is to keep the next slice narrow and preserve closure evidence."
        : "当前方向总体是对的。下一步最重要的是继续保持切片窄、闭环证据清楚。",
      priority: "LOW",
    });
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

function buildEmptyEngineeringDeliveryReview(input: {
  english: boolean;
  repoLabel: string;
  days: number;
}): EngineeringDeliveryReview {
  const windowLabel = input.english ? `Last ${input.days} days` : `最近 ${input.days} 天`;

  return {
    availability: "EMPTY",
    repoLabel: input.repoLabel,
    windowLabel,
    headline: input.english
      ? "There is no recent git activity window to review yet."
      : "当前还没有足够新的 git 活动窗口可供复盘。",
    summary: input.english
      ? "Once the repository has a real recent delivery window, this block can analyze contributors, closure, and collaboration."
      : "等仓库形成一段真实的近期交付窗口后，这里才能分析贡献者、闭环和协同。",
    sourceNote: input.english
      ? "Source: current repository git history."
      : "数据源：当前仓库 Git 历史。",
    boundaryNote: input.english
      ? "No judgement is produced when commit history is too thin."
      : "当提交历史过薄时，这里不会强行给出判断。",
    snapshot: {
      objectState: input.english ? "No recent commits" : "暂无近期提交",
      blocker: input.english
        ? "The signal window is empty, so quantity and quality judgements would be misleading."
        : "当前信号窗口为空，再去判断数量和质量会误导。",
      pendingDecision: input.english
        ? "Decide when this repository should be reviewed again."
        : "决定下一次什么时候重新看这条仓库线。",
      nextAction: input.english
        ? "Wait for a real activity window, then refresh the report."
        : "先等一段真实活动窗口形成，再刷新复盘。",
    },
    connections: [],
    contributors: [],
    collaboration: {
      summary: input.english
        ? "No collaboration signal is available yet."
        : "当前还没有可读的协同信号。",
      hotspots: [],
      risks: [],
      overlapPairs: [],
    },
    suggestions: [],
  };
}

function buildUnavailableEngineeringDeliveryReview(input: {
  english: boolean;
  repoLabel: string;
  days: number;
}): EngineeringDeliveryReview {
  const windowLabel = input.english ? `Last ${input.days} days` : `最近 ${input.days} 天`;

  return {
    availability: "UNAVAILABLE",
    repoLabel: input.repoLabel,
    windowLabel,
    headline: input.english
      ? "Git delivery review is unavailable in the current runtime."
      : "当前运行环境下无法读取 Git 交付复盘。",
    summary: input.english
      ? "This runtime could not read repository history, so the engineering review block falls back instead of inventing data."
      : "当前运行环境无法读取仓库历史，所以工程复盘区块会降级，而不是凭空生成数据。",
    sourceNote: input.english
      ? "Source unavailable: git command or repository metadata could not be read."
      : "数据源不可用：无法读取 Git 命令或仓库元数据。",
    boundaryNote: input.english
      ? "This block does not fabricate GitHub or git facts when repository access is missing."
      : "当仓库访问缺失时，这块不会伪造 GitHub 或 Git 事实。",
    snapshot: {
      objectState: input.english ? "Repository signal unavailable" : "仓库信号不可用",
      blocker: input.english
        ? "Current runtime access is missing, so contributor analysis cannot be trusted."
        : "当前运行环境缺少仓库访问，所以贡献者分析不可信。",
      pendingDecision: input.english
        ? "Decide whether the deployment runtime should expose repository history for this internal-only view."
        : "决定是否要让部署环境为这块内部视图暴露仓库历史。",
      nextAction: input.english
        ? "Keep the feature in fallback mode until repository access becomes available."
        : "在仓库访问可用之前，保持这块功能处于降级模式。",
    },
    connections: [],
    contributors: [],
    collaboration: {
      summary: input.english
        ? "Collaboration analysis is unavailable without repository history."
        : "没有仓库历史，就无法分析团队协同。",
      hotspots: [],
      risks: [],
      overlapPairs: [],
    },
    suggestions: [],
  };
}

function buildLiveFreshness(input: {
  english: boolean;
  sourceRevision: string | null;
}): EngineeringDeliveryReviewFreshness {
  return {
    mode: "LIVE",
    generatedAt: new Date().toISOString(),
    sourceRevision: input.sourceRevision,
    stale: false,
    note: input.english
      ? "Computed directly from the current repository state at read time."
      : "页面读取时直接基于当前仓库状态计算。",
  };
}

function resolveFocusKey(filePath: string): FocusKey {
  const normalized = filePath.trim().toLowerCase();
  const match = FOCUS_DEFINITIONS.find((item) => item.matcher(normalized));
  return match?.key ?? "other";
}

function getFocusLabel(key: FocusKey, english: boolean) {
  const definition = FOCUS_DEFINITIONS.find((item) => item.key === key);
  if (!definition) {
    return english ? "other" : "综合支撑";
  }

  return english ? definition.label.en : definition.label.zh;
}

function isAlignedFocus(key: FocusKey) {
  return FOCUS_DEFINITIONS.find((item) => item.key === key)?.aligned ?? false;
}

function countFocuses(files: GitFileStat[]) {
  return countFocusKeys(files.map((file) => file.focusKey));
}

function countFocusKeys(keys: FocusKey[]) {
  return keys.reduce((acc, key) => {
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map<FocusKey, number>());
}

function sortCounts<T>(counts: Map<T, number>) {
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

function buildAuthorKey(name: string, email: string) {
  return `${name} <${email}>`;
}

function getAuthorDisplayName(authorKey: string) {
  return authorKey.split(" <")[0] ?? authorKey;
}

function ratio(current: number, total: number) {
  if (!total) return 0;
  return current / total;
}

function commitTouchesClosure(commit: GitCommitRecord) {
  const focusKeys = new Set(commit.files.map((file) => file.focusKey));
  const implementationTouched = Array.from(focusKeys).some((key) => IMPLEMENTATION_FOCUS_KEYS.has(key));
  const closureTouched = Array.from(focusKeys).some(
    (key) => FOCUS_DEFINITIONS.find((item) => item.key === key)?.closureSignal,
  );

  return implementationTouched && closureTouched;
}

function isLargeCommit(commit: GitCommitRecord) {
  const changedLines = commit.files.reduce((sum, file) => sum + file.changedLines, 0);
  return changedLines >= LARGE_COMMIT_LINE_THRESHOLD || commit.files.length >= LARGE_COMMIT_FILE_THRESHOLD;
}

function countRepeatedFiles(filePaths: string[]) {
  const counts = filePaths.reduce((acc, filePath) => {
    acc.set(filePath, (acc.get(filePath) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return Array.from(counts.values()).filter((count) => count > 1).length;
}

function joinList(items: string[], english: boolean) {
  if (!items.length) {
    return english ? "unclear areas" : "不明确的区域";
  }

  if (items.length === 1) return items[0];
  if (items.length === 2) return english ? `${items[0]} and ${items[1]}` : `${items[0]} 和 ${items[1]}`;

  const leading = items.slice(0, -1).join(english ? ", " : "、");
  const trailing = items[items.length - 1];
  return english ? `${leading}, and ${trailing}` : `${leading}、${trailing}`;
}
