/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const path = require("path");

const {
  collectFilePaths,
  makeResult,
  normalizeToRepoRelative,
  parseInput,
  runCli,
} = require("./shared.cjs");

const PROTECTED_BASENAMES = new Set([
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "biome.json",
  "biome.jsonc",
  ".stylelintrc",
  ".stylelintrc.json",
  ".stylelintrc.yml",
  ".markdownlint.json",
  ".markdownlint.yaml",
  ".markdownlintrc",
]);

const PROTECTED_RELATIVE_PATHS = new Set([
  ".codex/config.toml",
  ".codex/hooks.json",
]);

function findProtectedTargets(filePaths) {
  return filePaths
    .map((filePath) => {
      const relativePath = normalizeToRepoRelative(filePath);
      const basename = path.basename(String(filePath));
      const matches =
        PROTECTED_BASENAMES.has(basename) ||
        PROTECTED_RELATIVE_PATHS.has(relativePath);

      return matches ? relativePath : null;
    })
    .filter(Boolean);
}

function run(inputOrRaw) {
  const input = parseInput(inputOrRaw);
  const protectedTargets = findProtectedTargets(collectFilePaths(input));

  if (protectedTargets.length > 0) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `BLOCKED: Modifying protected config files is disabled by default (${protectedTargets.join(
        ", ",
      )}). Fix source behavior instead of weakening repo guardrails. If this is a legitimate config change, disable the repo-local config-protection hook intentionally first.`,
    };
  }

  return makeResult();
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
