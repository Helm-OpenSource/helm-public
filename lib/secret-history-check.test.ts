import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type CompromisedCommit,
  runSecretHistoryCheck,
} from "../scripts/secret-history-check";

let repoRoot: string;

function git(args: string[]): string {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: "helm-fixture@example.invalid",
      GIT_AUTHOR_NAME: "Helm Fixture",
      GIT_COMMITTER_EMAIL: "helm-fixture@example.invalid",
      GIT_COMMITTER_NAME: "Helm Fixture",
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }

  return result.stdout.trim();
}

function commitFixture(label: string): string {
  writeFileSync(path.join(repoRoot, "fixture.txt"), `${label}\n`, "utf8");
  git(["add", "fixture.txt"]);
  git(["commit", "-m", label]);
  return git(["rev-parse", "HEAD"]);
}

function syntheticCompromisedCommit(sha: string): CompromisedCommit {
  return {
    sha,
    label: "synthetic compromised commit",
    fingerprintSha256: "synthetic-fixture-fingerprint",
    remediation: "Synthetic fixture remediation.",
  };
}

describe("secret history guard fixture coverage", () => {
  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(tmpdir(), "helm-secret-history-"));
    git(["init", "--initial-branch=main"]);
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("passes when a listed compromised commit object is absent", () => {
    const safeCommit = commitFixture("safe baseline");

    const result = runSecretHistoryCheck({
      repoPath: repoRoot,
      compromisedCommits: [
        syntheticCompromisedCommit("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      ],
    });

    expect(safeCommit).toHaveLength(40);
    expect(result.refs).toContain("HEAD");
    expect(result.violations).toEqual([]);
  });

  it("flags a compromised commit reachable from an explicit ref", () => {
    commitFixture("safe baseline");
    const compromisedSha = commitFixture("synthetic compromised baseline");

    const result = runSecretHistoryCheck({
      repoPath: repoRoot,
      refs: ["HEAD"],
      compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
    });

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      ref: "HEAD",
      commit: {
        sha: compromisedSha,
        label: "synthetic compromised commit",
      },
    });
    expect(result.baselineViolations).toEqual([]);
  });

  it("suppresses compromised commits already reachable from the configured baseline ref", () => {
    const compromisedSha = commitFixture("synthetic compromised baseline");
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    commitFixture("safe feature work");

    const result = runSecretHistoryCheck({
      repoPath: repoRoot,
      refs: ["HEAD"],
      baselineRef: "origin/main",
      compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
    });

    expect(result.baselineRef).toBe("origin/main");
    expect(result.violations).toEqual([]);
    expect(result.baselineViolations).toHaveLength(1);
    expect(result.baselineViolations[0]).toMatchObject({
      ref: "HEAD",
      commit: {
        sha: compromisedSha,
        label: "synthetic compromised commit",
      },
    });
  });

  it("still flags compromised commits that are not reachable from the configured baseline ref", () => {
    commitFixture("safe baseline");
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    const compromisedSha = commitFixture("synthetic compromised feature work");

    const result = runSecretHistoryCheck({
      repoPath: repoRoot,
      refs: ["HEAD"],
      baselineRef: "origin/main",
      compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
    });

    expect(result.baselineViolations).toEqual([]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.ref).toBe("HEAD");
  });

  it("does not flag existing compromised objects that are unreachable from scanned refs", () => {
    commitFixture("safe baseline");
    git(["switch", "-c", "leaky"]);
    const compromisedSha = commitFixture("synthetic compromised branch");
    git(["switch", "main"]);
    git(["branch", "-D", "leaky"]);

    const result = runSecretHistoryCheck({
      repoPath: repoRoot,
      compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
    });

    expect(git(["cat-file", "-t", compromisedSha])).toBe("commit");
    expect(result.refs).toEqual(["HEAD", "refs/heads/main"]);
    expect(result.violations).toEqual([]);
  });

  it("honors the configured ref list instead of scanning every branch", () => {
    commitFixture("safe baseline");
    git(["switch", "-c", "leaky"]);
    const compromisedSha = commitFixture("synthetic compromised branch");
    git(["switch", "main"]);

    const mainOnly = runSecretHistoryCheck({
      repoPath: repoRoot,
      refs: ["refs/heads/main"],
      compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
    });
    const leakyOnly = runSecretHistoryCheck({
      repoPath: repoRoot,
      refs: ["refs/heads/leaky"],
      compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
    });

    expect(mainOnly.violations).toEqual([]);
    expect(leakyOnly.violations).toHaveLength(1);
    expect(leakyOnly.violations[0]?.ref).toBe("refs/heads/leaky");
  });

  it("honors HELM_SECRET_HISTORY_REFS when options.refs is omitted", () => {
    commitFixture("safe baseline");
    git(["switch", "-c", "leaky"]);
    const compromisedSha = commitFixture("synthetic compromised branch");
    git(["switch", "main"]);

    const previousRefs = process.env.HELM_SECRET_HISTORY_REFS;
    try {
      process.env.HELM_SECRET_HISTORY_REFS = "refs/heads/main";
      const mainOnly = runSecretHistoryCheck({
        repoPath: repoRoot,
        compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
      });

      process.env.HELM_SECRET_HISTORY_REFS = "refs/heads/leaky";
      const leakyOnly = runSecretHistoryCheck({
        repoPath: repoRoot,
        compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
      });

      expect(mainOnly.refs).toEqual(["refs/heads/main"]);
      expect(mainOnly.violations).toEqual([]);
      expect(leakyOnly.refs).toEqual(["refs/heads/leaky"]);
      expect(leakyOnly.violations).toHaveLength(1);
      expect(leakyOnly.violations[0]?.ref).toBe("refs/heads/leaky");
    } finally {
      if (previousRefs === undefined) {
        delete process.env.HELM_SECRET_HISTORY_REFS;
      } else {
        process.env.HELM_SECRET_HISTORY_REFS = previousRefs;
      }
    }
  });

  it("honors HELM_SECRET_HISTORY_BASELINE_REF when options.baselineRef is omitted", () => {
    const compromisedSha = commitFixture("synthetic compromised baseline");
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    commitFixture("safe feature work");

    const previousBaselineRef = process.env.HELM_SECRET_HISTORY_BASELINE_REF;
    try {
      process.env.HELM_SECRET_HISTORY_BASELINE_REF = "origin/main";

      const result = runSecretHistoryCheck({
        repoPath: repoRoot,
        refs: ["HEAD"],
        compromisedCommits: [syntheticCompromisedCommit(compromisedSha)],
      });

      expect(result.baselineRef).toBe("origin/main");
      expect(result.violations).toEqual([]);
      expect(result.baselineViolations).toHaveLength(1);
    } finally {
      if (previousBaselineRef === undefined) {
        delete process.env.HELM_SECRET_HISTORY_BASELINE_REF;
      } else {
        process.env.HELM_SECRET_HISTORY_BASELINE_REF = previousBaselineRef;
      }
    }
  });
});
