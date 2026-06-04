#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

type GitResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export type CommitIdentityRole = "author" | "committer";

export type CommitMetadataRecord = {
  sha: string;
  authorName: string;
  authorEmail: string;
  committerName: string;
  committerEmail: string;
  subject: string;
};

export type CommitMetadataViolation = {
  sha: string;
  role: CommitIdentityRole;
  name: string;
  email: string;
  reason: string;
  subject: string;
};

export type CommitMetadataCheckOptions = {
  readonly repoPath?: string;
  readonly baselineRef?: string | null;
  readonly range?: string | null;
};

export type CommitMetadataCheckResult = {
  readonly repoPath: string;
  readonly range: string;
  readonly commits: readonly CommitMetadataRecord[];
  readonly violations: readonly CommitMetadataViolation[];
};

const FIELD_SEPARATOR = "\x1f";
const RECORD_SEPARATOR = "\x1e";

function git(repoPath: string, args: string[]): GitResult {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function gitOk(repoPath: string, args: string[]): boolean {
  return git(repoPath, args).status === 0;
}

function getConfiguredBaselineRef(): string | null {
  const configuredBaselineRef = process.env.HELM_PUBLIC_COMMIT_METADATA_BASELINE_REF?.trim();
  return configuredBaselineRef || null;
}

function resolveScanRange(repoPath: string, options: CommitMetadataCheckOptions): string {
  if (options.range) return options.range;

  const baselineRef = options.baselineRef ?? getConfiguredBaselineRef();
  if (
    baselineRef &&
    gitOk(repoPath, ["rev-parse", "--verify", "--quiet", `${baselineRef}^{commit}`])
  ) {
    return `${baselineRef}..HEAD`;
  }

  if (gitOk(repoPath, ["rev-parse", "--verify", "--quiet", "HEAD^"])) {
    return "HEAD^..HEAD";
  }

  return "HEAD";
}

export function parseCommitMetadataLog(stdout: string): CommitMetadataRecord[] {
  if (!stdout.trim()) return [];

  return stdout
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, authorName, authorEmail, committerName, committerEmail, subject] =
        record.split(FIELD_SEPARATOR);
      if (!sha || !authorEmail || !committerEmail) {
        throw new Error(`Malformed git metadata record: ${JSON.stringify(record)}`);
      }
      return {
        sha,
        authorName: authorName ?? "",
        authorEmail,
        committerName: committerName ?? "",
        committerEmail,
        subject: subject ?? "",
      };
    });
}

function classifyPublicEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return "email must include a public domain";
  }

  const domain = normalized.slice(atIndex + 1);
  if (domain === "localhost" || domain.endsWith(".localhost")) {
    return "localhost email domain is not public-safe";
  }
  if (domain === "local" || domain.endsWith(".local")) {
    return ".local email domain is not public-safe";
  }
  if (domain.includes(" ")) {
    return "email domain must not contain spaces";
  }

  return null;
}

function collectIdentityViolations(
  commit: CommitMetadataRecord,
  role: CommitIdentityRole,
  name: string,
  email: string,
): CommitMetadataViolation[] {
  const reason = classifyPublicEmail(email);
  if (!reason) return [];
  return [
    {
      sha: commit.sha,
      role,
      name,
      email,
      reason,
      subject: commit.subject,
    },
  ];
}

export function runPublicCommitMetadataCheck(
  options: CommitMetadataCheckOptions = {},
): CommitMetadataCheckResult {
  const repoPath = options.repoPath ?? process.env.HELM_PUBLIC_COMMIT_METADATA_REPO ?? process.cwd();
  const range = resolveScanRange(repoPath, options);
  const log = git(repoPath, [
    "log",
    "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s%x1e",
    range,
  ]);
  if (log.status !== 0) {
    throw new Error(`git log ${range} failed: ${log.stderr || log.stdout}`);
  }

  const commits = parseCommitMetadataLog(log.stdout);
  const violations = commits.flatMap((commit) => [
    ...collectIdentityViolations(commit, "author", commit.authorName, commit.authorEmail),
    ...collectIdentityViolations(commit, "committer", commit.committerName, commit.committerEmail),
  ]);

  return {
    repoPath,
    range,
    commits,
    violations,
  };
}

function main(): number {
  const result = runPublicCommitMetadataCheck();

  if (result.violations.length === 0) {
    console.log(
      `public-commit-metadata-check: PASS - scanned ${result.commits.length} commit(s) in ${result.range}.`,
    );
    return 0;
  }

  console.error(
    `public-commit-metadata-check: FAIL - ${result.violations.length} public metadata finding(s) in ${result.range}.`,
  );
  console.error(`repo: ${result.repoPath}`);
  console.error("");

  for (const violation of result.violations.slice(0, 40)) {
    console.error(
      `- commit=${violation.sha.slice(0, 12)} role=${violation.role} identity="${violation.name} <${violation.email}>" reason="${violation.reason}" subject="${violation.subject}"`,
    );
  }

  if (result.violations.length > 40) {
    console.error(`- ... ${result.violations.length - 40} more`);
  }

  console.error("");
  console.error("Required remediation:");
  console.error("1. Rewrite or replace the affected public PR commits with public-safe author and committer metadata.");
  console.error("2. Re-run this guard against the rewritten head before review/merge.");

  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
