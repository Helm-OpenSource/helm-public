/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {
  appendAccumulatorEntry,
  collectFilePaths,
  isCodeFile,
  makeResult,
  parseInput,
  runCli,
} = require("./shared.cjs");

function run(inputOrRaw) {
  const input = parseInput(inputOrRaw);

  for (const filePath of collectFilePaths(input)) {
    if (isCodeFile(filePath)) {
      appendAccumulatorEntry(input, filePath);
    }
  }

  return makeResult();
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
