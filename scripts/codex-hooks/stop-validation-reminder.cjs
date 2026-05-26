/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {
  clearAccumulator,
  normalizeToRepoRelative,
  parseInput,
  readAccumulatorEntries,
  runCli,
} = require("./shared.cjs");

const VALIDATION_FILE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|css|scss|json)$/i;

function buildReminder(filePaths) {
  const shownPaths = filePaths.slice(0, 8).map((filePath) => `  - ${normalizeToRepoRelative(filePath)}`);
  const hiddenCount = Math.max(0, filePaths.length - shownPaths.length);

  return [
    "[Hook] STOP VALIDATION: code/config file(s) edited this response:",
    shownPaths.join("\n"),
    hiddenCount > 0 ? `  - ... and ${hiddenCount} more` : null,
    "[Hook] Helm reminder:",
    "  - there is no dedicated `npm run format` script in this repo yet",
    "  - use `npm run lint` as the current style / formatting gate",
    "  - run `npm run typecheck` before closeout when TS/JS changed",
    "  - for broader slices, still consider `npm run self-check` and `npm run check:boundaries`",
  ]
    .filter(Boolean)
    .join("\n");
}

function run(inputOrRaw) {
  const input = parseInput(inputOrRaw);
  const filePaths = readAccumulatorEntries(input).filter((filePath) =>
    VALIDATION_FILE_EXTENSIONS.test(filePath),
  );

  clearAccumulator(input);

  if (filePaths.length === 0) {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  return {
    exitCode: 0,
    stdout: JSON.stringify({
      systemMessage: buildReminder(filePaths),
    }),
    stderr: "",
  };
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
