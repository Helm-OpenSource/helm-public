/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { makeResult, parseInput, runCli } = require("./shared.cjs");

function run(inputOrRaw) {
  const input = parseInput(inputOrRaw);
  const command = String(input?.tool_input?.command ?? "");

  if (/\bgit\b/.test(command) && /(^|\s)--no-verify(?:\s|$)/.test(command)) {
    return {
      exitCode: 2,
      stdout: "",
      stderr:
        "BLOCKED: `git --no-verify` bypasses repo git hooks. Keep pre-commit, commit-msg, and pre-push protection active by default. If this bypass is truly required, disable the repo-local guardrail intentionally first.",
    };
  }

  return makeResult();
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
