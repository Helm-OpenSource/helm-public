/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {
  collectFilePaths,
  makeResult,
  makeSystemMessageResult,
  normalizeToRepoRelative,
  parseInput,
  readFile,
  runCli,
} = require("./shared.cjs");

const JS_TS_FILE = /\.(?:[cm]?[jt]sx?)$/i;

function isCommentOnlyLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*/")
  );
}

function collectMatches(filePath) {
  if (!JS_TS_FILE.test(filePath)) {
    return [];
  }

  const content = readFile(filePath);
  if (!content) {
    return [];
  }

  const matches = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const commentOnly = isCommentOnlyLine(line);

    if (/TODO:?\s*remove before merge/i.test(trimmed)) {
      matches.push({
        type: "TODO remove before merge",
        lineNumber: index + 1,
        line: trimmed,
      });
    }

    if (commentOnly) {
      return;
    }

    if (line.includes("console.log")) {
      matches.push({
        type: "console.log",
        lineNumber: index + 1,
        line: trimmed,
      });
    }

    if (line.includes("console.error")) {
      matches.push({
        type: "console.error",
        lineNumber: index + 1,
        line: trimmed,
      });
    }

    if (/\bdebugger\b/.test(line)) {
      matches.push({
        type: "debugger",
        lineNumber: index + 1,
        line: trimmed,
      });
    }
  });

  return matches;
}

function buildWarning(findingsByFile) {
  const output = [
    "[Hook] DEBUG ARTIFACT CHECK: remove debug / merge leftovers before closeout:",
  ];

  for (const { filePath, matches } of findingsByFile) {
    output.push(`  - ${normalizeToRepoRelative(filePath)}`);
    for (const match of matches.slice(0, 6)) {
      output.push(`    - line ${match.lineNumber}: ${match.type} -> ${match.line}`);
    }
  }

  return output.join("\n");
}

function run(inputOrRaw) {
  const input = parseInput(inputOrRaw);
  const findingsByFile = [];

  for (const filePath of collectFilePaths(input)) {
    const matches = collectMatches(filePath);
    if (matches.length > 0) {
      findingsByFile.push({ filePath, matches });
    }
  }

  if (findingsByFile.length === 0) {
    return makeResult();
  }

  return makeSystemMessageResult(buildWarning(findingsByFile));
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
