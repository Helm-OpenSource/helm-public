#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

type GitResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export type CompromisedCommit = {
  sha: string;
  label: string;
  fingerprintSha256: string;
  remediation: string;
};

export type SecretHistoryCheckOptions = {
  readonly repoPath?: string;
  readonly refs?: readonly string[];
  readonly baselineRef?: string | null;
  readonly compromisedCommits?: readonly CompromisedCommit[];
};

export type SecretHistoryViolation = {
  ref: string;
  commit: CompromisedCommit;
};

export type SecretHistoryCheckResult = {
  readonly repoPath: string;
  readonly refs: readonly string[];
  readonly baselineRef: string | null;
  readonly violations: readonly SecretHistoryViolation[];
  readonly baselineViolations: readonly SecretHistoryViolation[];
};

export const COMPROMISED_COMMITS: readonly CompromisedCommit[] = [
  {
    sha: "d0dc341178a12a1f89698eced116ce6d168debc7",
    label: "2026-04-27 RDS root credential leak",
    fingerprintSha256: "1f2690821816efa16646ccb339b92178107ac6a29d98938379002868c86736e6",
    remediation: "Rotate or revoke the exposed RDS credential, then rewrite public history.",
  },
  {
    sha: "7d2899355dca9b3cd100e66305706e1b7859de3b",
    label: "2026-04-27 RDS root credential leak",
    fingerprintSha256: "1f2690821816efa16646ccb339b92178107ac6a29d98938379002868c86736e6",
    remediation: "Rotate or revoke the exposed RDS credential, then rewrite public history.",
  },
  {
    sha: "f7876c7dce7405c0cb91365e0fe94b80421b83c1",
    label: "2026-04-27 RDS root credential leak",
    fingerprintSha256: "1f2690821816efa16646ccb339b92178107ac6a29d98938379002868c86736e6",
    remediation: "Rotate or revoke the exposed RDS credential, then rewrite public history.",
  },
];

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

function getConfiguredRefs(): string[] | undefined {
  const configuredRefs = process.env.HELM_SECRET_HISTORY_REFS;
  if (configuredRefs) {
    return configuredRefs
      .split(",")
      .map((ref) => ref.trim())
      .filter(Boolean);
  }
  return undefined;
}

function getConfiguredBaselineRef(): string | null {
  const configuredBaselineRef = process.env.HELM_SECRET_HISTORY_BASELINE_REF?.trim();
  return configuredBaselineRef || null;
}

function getRefs(repoPath: string, configuredRefs?: readonly string[]): string[] {
  if (configuredRefs) return [...configuredRefs];

  const refs = git(repoPath, ["for-each-ref", "--format=%(refname)"]);
  const refNames = refs.status === 0 && refs.stdout ? refs.stdout.split(/\r?\n/) : [];
  return Array.from(new Set(["HEAD", ...refNames]));
}

export function runSecretHistoryCheck(
  options: SecretHistoryCheckOptions = {},
): SecretHistoryCheckResult {
  const repoPath = options.repoPath ?? process.env.HELM_SECRET_HISTORY_REPO ?? process.cwd();
  const compromisedCommits = options.compromisedCommits ?? COMPROMISED_COMMITS;
  const refs = getRefs(repoPath, options.refs ?? getConfiguredRefs());
  const baselineRef = options.baselineRef ?? getConfiguredBaselineRef();
  const violations: SecretHistoryViolation[] = [];
  const baselineViolations: SecretHistoryViolation[] = [];

  for (const commit of compromisedCommits) {
    if (!gitOk(repoPath, ["cat-file", "-e", `${commit.sha}^{commit}`])) continue;
    const isBaselineKnown = baselineRef
      ? gitOk(repoPath, ["rev-parse", "--verify", "--quiet", `${baselineRef}^{commit}`]) &&
        gitOk(repoPath, ["merge-base", "--is-ancestor", commit.sha, baselineRef])
      : false;

    for (const ref of refs) {
      if (!gitOk(repoPath, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])) continue;
      if (gitOk(repoPath, ["merge-base", "--is-ancestor", commit.sha, ref])) {
        const violation = { ref, commit };
        if (isBaselineKnown) {
          baselineViolations.push(violation);
        } else {
          violations.push(violation);
        }
      }
    }
  }

  return {
    repoPath,
    refs,
    baselineRef,
    violations,
    baselineViolations,
  };
}

function main(): number {
  const result = runSecretHistoryCheck();
  const violations = [...result.violations];
  const refs = [...result.refs];

  if (violations.length === 0) {
    if (result.baselineViolations.length > 0) {
      console.warn(
        `secret-history-check: PASS - no new known compromised commits beyond baseline ${result.baselineRef}; ${result.baselineViolations.length} baseline-known finding(s) suppressed.`,
      );
      console.warn(
        "secret-history-check: baseline suppression is for PR CI only; release sources still require full history remediation.",
      );
      return 0;
    }

    console.log(
      `secret-history-check: PASS - no known compromised commits are reachable in ${refs.length} ref(s).`,
    );
    return 0;
  }

  console.error(
    `secret-history-check: FAIL - ${violations.length} known compromised commit reachability finding(s).`,
  );
  console.error(`repo: ${result.repoPath}`);
  console.error("");

  for (const { ref, commit } of violations.slice(0, 60)) {
    console.error(
      `- ref=${ref} commit=${commit.sha.slice(0, 12)} label="${commit.label}" fingerprint=sha256:${commit.fingerprintSha256}`,
    );
  }

  if (violations.length > 60) {
    console.error(`- ... ${violations.length - 60} more`);
  }

  console.error("");
  console.error("Required remediation:");
  console.error("1. Confirm the exposed credential is rotated/revoked outside git.");
  console.error("2. Rewrite public history in a mirror clone using git-filter-repo.");
  console.error("3. Force-push only inside a coordinated maintenance window.");
  console.error("4. Re-run this check against the rewritten mirror and origin after push.");

  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
