/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { makeHookAdditionalContextResult, runCli } = require("./shared.cjs");

function run() {
  return makeHookAdditionalContextResult(
    "SessionStart",
    [
      "[Hook] HELM SESSION START:",
      "  - read AGENTS.md -> README.md -> docs/README.md -> WORKING-CONTEXT.md",
      "  - if the task touches UI, read DESIGN.md before editing",
      "  - repo-local guardrails are active for no-verify, git push reminder, config protection, design/debug checks, and stop validation reminders",
    ].join("\n"),
  );
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
