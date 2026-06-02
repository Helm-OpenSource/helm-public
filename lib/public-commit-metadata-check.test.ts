import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  parseCommitMetadataLog,
  runPublicCommitMetadataCheck,
} from "../scripts/public-commit-metadata-check";

let repoRoot: string;

type Identity = {
  name: string;
  email: string;
};

const safeIdentity: Identity = {
  name: "Helm Fixture",
  email: "helm-fixture@example.invalid",
};

function git(args: string[], identity: Identity = safeIdentity): string {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: identity.email,
      GIT_AUTHOR_NAME: identity.name,
      GIT_COMMITTER_EMAIL: identity.email,
      GIT_COMMITTER_NAME: identity.name,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }

  return result.stdout.trim();
}

function commitFixture(label: string, identity: Identity = safeIdentity): string {
  writeFileSync(path.join(repoRoot, "fixture.txt"), `${label}\n`, "utf8");
  git(["add", "fixture.txt"], identity);
  git(["commit", "-m", label], identity);
  return git(["rev-parse", "HEAD"], identity);
}

describe("public commit metadata guard", () => {
  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(tmpdir(), "helm-public-commit-metadata-"));
    git(["init", "--initial-branch=main"]);
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("parses NUL-safe git log fields", () => {
    const parsed = parseCommitMetadataLog(
      [
        "abc123",
        "Author",
        "author@example.invalid",
        "Committer",
        "committer@example.invalid",
        "subject",
      ].join("\x1f") + "\x1e",
    );

    expect(parsed).toEqual([
      {
        sha: "abc123",
        authorName: "Author",
        authorEmail: "author@example.invalid",
        committerName: "Committer",
        committerEmail: "committer@example.invalid",
        subject: "subject",
      },
    ]);
  });

  it("passes public-safe author and committer metadata", () => {
    commitFixture("safe baseline");
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    commitFixture("safe feature");

    const result = runPublicCommitMetadataCheck({
      repoPath: repoRoot,
      baselineRef: "origin/main",
    });

    expect(result.range).toBe("origin/main..HEAD");
    expect(result.commits).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });

  it("flags local author metadata on new PR commits", () => {
    commitFixture("safe baseline");
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    commitFixture("local author", {
      name: "CHM",
      email: "chm@Mac-Studio.local",
    });

    const result = runPublicCommitMetadataCheck({
      repoPath: repoRoot,
      baselineRef: "origin/main",
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        role: "author",
        email: "chm@Mac-Studio.local",
        reason: ".local email domain is not public-safe",
      }),
      expect.objectContaining({
        role: "committer",
        email: "chm@Mac-Studio.local",
        reason: ".local email domain is not public-safe",
      }),
    ]);
  });

  it("ignores local metadata that is already in the baseline range", () => {
    commitFixture("local baseline", {
      name: "CHM",
      email: "chm@Mac-Studio.local",
    });
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    commitFixture("safe feature");

    const result = runPublicCommitMetadataCheck({
      repoPath: repoRoot,
      baselineRef: "origin/main",
    });

    expect(result.commits.map((commit) => commit.subject)).toEqual(["safe feature"]);
    expect(result.violations).toEqual([]);
  });

  it("flags localhost-style committer metadata", () => {
    commitFixture("safe baseline");
    git(["branch", "origin/main"]);
    git(["switch", "-c", "feature"]);
    commitFixture("localhost committer", {
      name: "Local User",
      email: "local@localhost",
    });

    const result = runPublicCommitMetadataCheck({
      repoPath: repoRoot,
      baselineRef: "origin/main",
    });

    expect(result.violations.map((violation) => violation.reason)).toEqual([
      "localhost email domain is not public-safe",
      "localhost email domain is not public-safe",
    ]);
  });

  it("falls back to the latest commit range when no baseline is configured", () => {
    commitFixture("safe baseline");
    commitFixture("safe head");

    const result = runPublicCommitMetadataCheck({
      repoPath: repoRoot,
      baselineRef: null,
    });

    expect(result.range).toBe("HEAD^..HEAD");
    expect(result.commits.map((commit) => commit.subject)).toEqual(["safe head"]);
    expect(result.violations).toEqual([]);
  });
});
