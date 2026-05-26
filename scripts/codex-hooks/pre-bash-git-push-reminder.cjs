/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { execFileSync } = require("node:child_process");

const {
  makeResult,
  makeSystemMessageResult,
  parseInput,
  runCli,
} = require("./shared.cjs");

function runGit(args, exec = execFileSync) {
  try {
    return String(
      exec("git", args, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }) ?? "",
    ).trim();
  } catch {
    return "";
  }
}

function getRepoState(exec = execFileSync) {
  const dirtyEntries = runGit(["status", "--short"], exec)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const branch = runGit(["branch", "--show-current"], exec);
  const upstream = runGit(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    exec,
  );

  let behind = 0;
  if (upstream) {
    const counts = runGit(["rev-list", "--left-right", "--count", `HEAD...${upstream}`], exec)
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10));
    behind = Number.isFinite(counts[1]) ? counts[1] : 0;
  }

  return {
    branch,
    upstream,
    behind,
    dirtyEntries,
  };
}

function buildReminder(repoState) {
  const lines = [
    "[Hook] GIT PUSH REMINDER:",
    "  - re-check the diff you are about to publish",
    "  - confirm the intended remote / branch target",
    "  - confirm validation status is explicit in your closeout",
  ];

  if (repoState.dirtyEntries.length > 0) {
    lines.push(
      `  - dirty worktree: ${repoState.dirtyEntries.length} path(s) still differ from HEAD`,
      "    unpublished local edits may not be part of the commit(s) you are pushing",
    );
  }

  if (repoState.upstream && repoState.behind > 0) {
    lines.push(
      `  - upstream drift: current branch is behind ${repoState.upstream} by ${repoState.behind} commit(s) based on local refs`,
    );
  }

  if (repoState.branch && !repoState.upstream) {
    lines.push(
      `  - upstream check skipped: ${repoState.branch} does not have a tracked upstream branch`,
    );
  }

  return lines.join("\n");
}

function run(inputOrRaw, deps = {}) {
  const input = parseInput(inputOrRaw);
  const command = String(input?.tool_input?.command ?? "");

  if (/\bgit\s+push\b/.test(command)) {
    const repoState = (deps.getRepoState ?? getRepoState)(deps.execFileSync ?? execFileSync);
    return makeSystemMessageResult(buildReminder(repoState));
  }

  return makeResult();
}

module.exports = { buildReminder, getRepoState, run };

if (require.main === module) {
  runCli(run);
}
