#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function runGit(cwd, args, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
  } catch (error) {
    if (options.allowFailure) return null;
    throw error;
  }
}

export function parseWorktreePorcelain(output) {
  if (!output.trim()) return [];

  return output
    .split(/\n\s*\n/)
    .map((block) => {
      const entry = {
        path: "",
        head: "",
        branch: null,
        detached: false,
        prunable: false,
        prunableReason: null,
      };

      for (const line of block.split("\n")) {
        const [key, ...restParts] = line.split(" ");
        const rest = restParts.join(" ");
        if (key === "worktree") entry.path = rest;
        if (key === "HEAD") entry.head = rest;
        if (key === "branch") entry.branch = rest.replace(/^refs\/heads\//, "");
        if (key === "detached") entry.detached = true;
        if (key === "prunable") {
          entry.prunable = true;
          entry.prunableReason = rest || "prunable";
        }
      }

      return entry;
    })
    .filter((entry) => entry.path);
}

function parseArgs(args) {
  const options = {
    repo: ".",
    json: false,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--repo") {
      const value = args[index + 1];
      if (!value) throw new Error("--repo requires a path");
      options.repo = value;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--strict") {
      options.strict = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getRepoRoot(repo) {
  const root = runGit(resolve(repo), ["rev-parse", "--show-toplevel"]);
  return resolve(root);
}

function readStatus(worktreePath) {
  if (!existsSync(worktreePath)) {
    return {
      exists: false,
      readable: false,
      clean: false,
      trackedChanges: 0,
      untrackedChanges: 0,
      totalChanges: 0,
    };
  }

  const output = runGit(worktreePath, ["status", "--porcelain=v1"], {
    allowFailure: true,
  });
  if (output === null) {
    return {
      exists: true,
      readable: false,
      clean: false,
      trackedChanges: 0,
      untrackedChanges: 0,
      totalChanges: 0,
    };
  }

  const lines = output ? output.split("\n").filter(Boolean) : [];
  const untrackedChanges = lines.filter((line) => line.startsWith("??")).length;
  return {
    exists: true,
    readable: true,
    clean: lines.length === 0,
    trackedChanges: lines.length - untrackedChanges,
    untrackedChanges,
    totalChanges: lines.length,
  };
}

function refExists(repoRoot, ref) {
  return (
    runGit(repoRoot, ["rev-parse", "--verify", "--quiet", ref], {
      allowFailure: true,
    }) !== null
  );
}

function isAncestor(repoRoot, ancestor, descendant) {
  return (
    runGit(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant], {
      allowFailure: true,
    }) !== null
  );
}

function resolveMergeTarget(repoRoot) {
  if (refExists(repoRoot, "origin/main")) return "origin/main";
  if (refExists(repoRoot, "main")) return "main";
  if (refExists(repoRoot, "origin/master")) return "origin/master";
  if (refExists(repoRoot, "master")) return "master";
  return null;
}

export function groupDuplicateBranches(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.branch || entry.prunable) continue;
    const current = groups.get(entry.branch) ?? [];
    current.push(entry.path);
    groups.set(entry.branch, current);
  }

  return [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([branch, paths]) => ({ branch, paths }));
}

export function auditWorktrees(repoRoot) {
  const root = getRepoRoot(repoRoot);
  const mergeTarget = resolveMergeTarget(root);
  const entries = parseWorktreePorcelain(
    runGit(root, ["worktree", "list", "--porcelain"]),
  ).map((entry) => {
    const status = readStatus(entry.path);
    const mergedToTarget =
      mergeTarget && entry.head ? isAncestor(root, entry.head, mergeTarget) : false;
    const isCurrentRoot = resolve(entry.path) === root;
    const isDefaultBranch =
      entry.branch === "main" || entry.branch === "master" || entry.branch === null;
    const cleanupCandidate =
      status.exists &&
      status.readable &&
      status.clean &&
      !entry.prunable &&
      !isCurrentRoot &&
      !isDefaultBranch &&
      Boolean(mergedToTarget);

    return {
      ...entry,
      status,
      mergedToTarget,
      cleanupCandidate,
    };
  });

  const duplicateBranches = groupDuplicateBranches(entries);
  const prunableWorktrees = entries.filter((entry) => entry.prunable);
  const dirtyWorktrees = entries.filter(
    (entry) => entry.status.exists && entry.status.readable && !entry.status.clean,
  );
  const unreadableWorktrees = entries.filter(
    (entry) => entry.status.exists && !entry.status.readable,
  );
  const cleanupCandidates = entries.filter((entry) => entry.cleanupCandidate);
  const findings = [
    ...prunableWorktrees.map((entry) => ({
      severity: "warn",
      code: "WT_PRUNABLE",
      message: `Prunable worktree metadata remains for ${entry.path}`,
    })),
    ...duplicateBranches.map((group) => ({
      severity: "warn",
      code: "WT_DUPLICATE_BRANCH",
      message: `Branch ${group.branch} is checked out in ${group.paths.length} worktrees`,
    })),
    ...unreadableWorktrees.map((entry) => ({
      severity: "warn",
      code: "WT_STATUS_UNREADABLE",
      message: `Could not read git status for ${entry.path}`,
    })),
    ...dirtyWorktrees.map((entry) => ({
      severity: "info",
      code: "WT_DIRTY",
      message: `${entry.path} has ${entry.status.totalChanges} uncommitted change(s)`,
    })),
    ...cleanupCandidates.map((entry) => ({
      severity: "info",
      code: "WT_CLEAN_MERGED_CANDIDATE",
      message: `${entry.path} is clean and merged to ${mergeTarget}`,
    })),
  ];

  return {
    repoRoot: root,
    mergeTarget,
    totalWorktrees: entries.length,
    dirtyWorktrees: dirtyWorktrees.length,
    prunableWorktrees: prunableWorktrees.length,
    duplicateBranches,
    cleanupCandidates,
    entries,
    findings,
  };
}

function printHelp() {
  console.log(`Usage: node scripts/worktree-governance-audit.mjs [--repo PATH] [--json] [--strict]

Read-only audit for multi-agent Git worktree hygiene.

Options:
  --repo PATH   Any path inside the repository to audit. Defaults to current directory.
  --json        Print the full audit result as JSON.
  --strict      Exit non-zero on warning-level findings.
`);
}

function printText(result) {
  console.log("Helm worktree governance audit");
  console.log(`repoRoot=${result.repoRoot}`);
  console.log(`mergeTarget=${result.mergeTarget ?? "unavailable"}`);
  console.log(`totalWorktrees=${result.totalWorktrees}`);
  console.log(`dirtyWorktrees=${result.dirtyWorktrees}`);
  console.log(`prunableWorktrees=${result.prunableWorktrees}`);
  console.log(`duplicateBranches=${result.duplicateBranches.length}`);
  console.log(`cleanupCandidates=${result.cleanupCandidates.length}`);

  if (result.findings.length > 0) {
    console.log("\nFindings:");
    for (const finding of result.findings) {
      console.log(`- ${finding.severity} ${finding.code}: ${finding.message}`);
    }
  }

  if (result.cleanupCandidates.length > 0) {
    console.log("\nOwner-reviewed cleanup candidates:");
    for (const entry of result.cleanupCandidates) {
      console.log(`- git worktree remove ${JSON.stringify(entry.path)}`);
    }
  }

  console.log("\nSafe cleanup rehearsal:");
  console.log("git worktree prune --dry-run");
  console.log("Only after owner review: run the printed remove/prune commands manually.");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  const result = auditWorktrees(options.repo);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }

  if (
    options.strict &&
    result.findings.some((finding) => finding.severity === "warn")
  ) {
    return 1;
  }
  return 0;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
