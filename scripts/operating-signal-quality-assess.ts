#!/usr/bin/env tsx
/**
 * Operating Signal Quality Assessment CLI
 *
 * 把本地 git log 转成 OperatingSignalQualityEvidence，跑评分函数，输出 markdown。
 *
 * 用法：
 *   npm run operating-signal-quality:assess -- --since="2 days ago"
 *   npm run operating-signal-quality:assess -- --commits=20 --subject="Tommy"
 *   npm run operating-signal-quality:assess -- --since="1 week ago" --english --json
 *
 * 边界：
 * - 这是本地分析工具，read-only，不写远端、不写 DB、不发通知。
 * - 评估快照仅供 Helm reserved tenant 内部复核参考，不是绩效合同或结算依据。
 * - AI Co-Authored-By 不会被记成单独 contributor，归属仍是 commit author。
 */

import { execSync } from "node:child_process";
import { assessOperatingSignalQuality } from "@/lib/operating-signal-quality/assess";
import {
  collectOperatingSignalQualityEvidenceFromGitHub,
  type CollectorCommit,
} from "@/lib/operating-signal-quality/collect-from-github";
import {
  formatOperatingSignalQualityReadout,
  formatOperatingSignalQualityReadoutAsMarkdown,
} from "@/lib/operating-signal-quality/format-readout";
import type { OperatingSignalQualitySubjectKind } from "@/lib/operating-signal-quality/types";
import {
  buildWeeklyScorecard,
  formatWeeklyScorecardAsMarkdown,
} from "@/lib/operating-signal-quality/weekly-scorecard";

type CliMode = "batch" | "weekly";

type CliArgs = {
  since: string | null;
  commits: number | null;
  subject: string;
  subjectKind: OperatingSignalQualitySubjectKind;
  english: boolean;
  json: boolean;
  mode: CliMode;
  windowLabel: string | null;
};

function parseArgs(): CliArgs {
  const raw = process.argv.slice(2);
  const args: CliArgs = {
    since: null,
    commits: null,
    subject: "Recent activity",
    subjectKind: "delivery_batch",
    english: false,
    json: false,
    mode: "batch",
    windowLabel: null,
  };
  for (const arg of raw) {
    if (arg.startsWith("--since=")) {
      args.since = arg.slice("--since=".length);
    } else if (arg.startsWith("--commits=")) {
      const value = Number(arg.slice("--commits=".length));
      args.commits = Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
    } else if (arg.startsWith("--subject=")) {
      args.subject = arg.slice("--subject=".length);
    } else if (arg.startsWith("--subject-kind=")) {
      const value = arg.slice(
        "--subject-kind=".length,
      ) as OperatingSignalQualitySubjectKind;
      if (
        value === "contributor" ||
        value === "delivery_batch" ||
        value === "data_source" ||
        value === "operating_signal_source"
      ) {
        args.subjectKind = value;
      }
    } else if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (value === "weekly" || value === "batch") {
        args.mode = value;
      }
    } else if (arg.startsWith("--window-label=")) {
      args.windowLabel = arg.slice("--window-label=".length);
    } else if (arg === "--english") {
      args.english = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  if (!args.since && !args.commits) {
    args.commits = 20;
  }
  return args;
}

function printHelp() {
  console.log(`Operating Signal Quality Assessment CLI

Reads local git log and produces a quality assessment markdown.

Options:
  --since=<git-since>       e.g. "2 days ago" / "2026-05-01" / "24h"
  --commits=<N>             use the last N commits (default 20 when --since absent)
  --mode=batch|weekly       batch (default): single readout for the whole window;
                            weekly: per-contributor ranked scorecard table
  --window-label=<label>    label for weekly mode (default derives from --since or --commits)
  --subject="<label>"       (batch only) display label for the subject
  --subject-kind=<kind>     (batch only) contributor | delivery_batch | data_source | operating_signal_source
  --english                 emit english markdown
  --json                    emit JSON instead of markdown
  -h, --help                show this help

Examples:
  npm run operating-signal-quality:assess -- --commits=20
  npm run operating-signal-quality:assess -- --mode=weekly --since="7 days ago"
  npm run operating-signal-quality:assess -- --mode=weekly --commits=50 --json
`);
}

const COMMIT_DELIM = "<<<HELM_COMMIT_DELIM>>>";
const FIELD_DELIM = "<<<HELM_FIELD_DELIM>>>";

function gitLogCommits(args: CliArgs): CollectorCommit[] {
  const format = [
    "%H",
    "%P",
    "%an",
    "%ae",
    "%s",
    "%b",
  ].join(FIELD_DELIM);
  const since = args.since ? `--since=${shellQuote(args.since)}` : "";
  const limit = args.commits ? `-n ${args.commits}` : "";
  const logCmd = `git log ${since} ${limit} --pretty=format:${shellQuote(`${COMMIT_DELIM}${format}`)} --numstat`;
  const raw = execSync(logCmd, { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const blocks = raw.split(COMMIT_DELIM).map((block) => block.trim()).filter(Boolean);
  const commits: CollectorCommit[] = [];
  for (const block of blocks) {
    // Block looks like:
    //   <sha>FIELD<parents>FIELD<author>FIELD<email>FIELD<subject>FIELD<body>
    //   <blank line>
    //   <num adds> <num dels> <path>
    //   ...
    const [headerLine, ...rest] = block.split(/\r?\n/);
    const [sha, parents, authorName, authorEmail, subject, ...bodyParts] =
      headerLine.split(FIELD_DELIM);
    let additions = 0;
    let deletions = 0;
    const files: string[] = [];
    // 多行 body 的剩余部分会落到 rest 里和 numstat 行混在一起。
    // numstat 行严格匹配 `<num|->\t<num|->\t<path>`，body 行（含 Co-Authored-By）
    // 不会匹配此模式 → 用这个区分。
    const bodyLines: string[] = [];
    if (bodyParts.length) {
      bodyLines.push(bodyParts.join(FIELD_DELIM));
    }
    for (const line of rest) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
      if (match) {
        const adds = match[1] === "-" ? 0 : Number(match[1]);
        const dels = match[2] === "-" ? 0 : Number(match[2]);
        additions += Number.isFinite(adds) ? adds : 0;
        deletions += Number.isFinite(dels) ? dels : 0;
        files.push(match[3]);
      } else {
        bodyLines.push(line);
      }
    }
    const body = bodyLines.join("\n").trim();
    const isMerge = (parents ?? "").split(" ").filter(Boolean).length > 1;
    const subjectLower = subject.toLowerCase();
    const isRevert = subjectLower.startsWith("revert:") || subjectLower.startsWith("revert ");
    const coAuthors = extractCoAuthors(body);
    commits.push({
      sha,
      message: `${subject}\n\n${body}`.trim(),
      author: {
        name: authorName,
        email: authorEmail,
        // 不强行 fabricate github login — caller 如果要 attribution 可以传 manualOverrides。
        githubLogin: null,
      },
      coAuthors,
      filesChanged: files,
      additions,
      deletions,
      isMerge,
      isRevert,
    });
  }
  return commits;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function extractCoAuthors(body: string) {
  const lines = body.split(/\r?\n/);
  const co: { name: string; email: string }[] = [];
  for (const line of lines) {
    const match = line.match(/^Co-Authored-By:\s*(.+?)\s*<([^>]+)>/i);
    if (match) {
      co.push({ name: match[1].trim(), email: match[2].trim() });
    }
  }
  return co;
}

function deriveWindowLabel(args: CliArgs, commitCount: number) {
  if (args.windowLabel) return args.windowLabel;
  if (args.since) return args.since;
  return `last ${commitCount} commits`;
}

function runBatchMode(args: CliArgs, commits: CollectorCommit[]) {
  const { evidence, attribution } =
    collectOperatingSignalQualityEvidenceFromGitHub({ commits });
  const subjectLabel =
    args.subject === "Recent activity" && commits.length > 0
      ? `${commits.length} commits${attribution.primaryGithubLogin ? ` · ${attribution.primaryGithubLogin}` : ""}`
      : args.subject;
  const assessment = assessOperatingSignalQuality({
    subject: {
      kind: args.subjectKind,
      label: subjectLabel,
      githubHandle: attribution.primaryGithubLogin,
    },
    evidence,
  });

  if (args.json) {
    const readout = formatOperatingSignalQualityReadout({
      assessment,
      english: args.english,
    });
    console.log(
      JSON.stringify(
        {
          mode: "batch",
          assessment,
          readout,
          attribution,
          commitCount: commits.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const md = formatOperatingSignalQualityReadoutAsMarkdown({
    assessment,
    english: args.english,
  });
  console.log(md);
  console.log("");
  console.log(
    args.english
      ? `_Based on ${commits.length} commits. AI co-author ratio: ${(attribution.aiCoAuthorRatio * 100).toFixed(0)}% (informational only)._`
      : `_本评估基于 ${commits.length} 个 commit。AI 共同署名比例：${(attribution.aiCoAuthorRatio * 100).toFixed(0)}%（仅作 informational 标注，不影响评分）。_`,
  );
}

function runWeeklyMode(args: CliArgs, commits: CollectorCommit[]) {
  const windowLabel = deriveWindowLabel(args, commits.length);
  const scorecard = buildWeeklyScorecard({ commits, windowLabel });
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          mode: "weekly",
          scorecard,
        },
        null,
        2,
      ),
    );
    return;
  }
  const md = formatWeeklyScorecardAsMarkdown({
    scorecard,
    english: args.english,
  });
  console.log(md);
}

function main() {
  const args = parseArgs();
  const commits = gitLogCommits(args);
  if (commits.length === 0) {
    console.error("[operating-signal-quality] no commits matched the given range");
    process.exitCode = 1;
    return;
  }
  if (args.mode === "weekly") {
    runWeeklyMode(args, commits);
  } else {
    runBatchMode(args, commits);
  }
}

main();
