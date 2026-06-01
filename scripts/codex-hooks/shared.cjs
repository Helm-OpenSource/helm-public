/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_STDIN = 1024 * 1024;
const CODE_FILE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|json|css|scss)$/i;
const FRONTEND_FILE_EXTENSIONS = /\.(?:tsx|jsx|css|scss)$/i;

function toRawString(inputOrRaw) {
  if (typeof inputOrRaw === "string") {
    return inputOrRaw;
  }

  try {
    return JSON.stringify(inputOrRaw ?? {});
  } catch {
    return "";
  }
}

function parseInput(inputOrRaw) {
  if (typeof inputOrRaw === "string") {
    try {
      return inputOrRaw.trim() ? JSON.parse(inputOrRaw) : {};
    } catch {
      return {};
    }
  }

  return inputOrRaw && typeof inputOrRaw === "object" ? inputOrRaw : {};
}

function makeResult(rawInput, overrides = {}) {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    ...overrides,
  };
}

function makeSystemMessageResult(systemMessage, overrides = {}) {
  return makeResult(null, {
    stdout: JSON.stringify({
      systemMessage,
    }),
    ...overrides,
  });
}

function makeHookAdditionalContextResult(hookEventName, additionalContext, overrides = {}) {
  return makeResult(null, {
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName,
        additionalContext,
      },
    }),
    ...overrides,
  });
}

function collectFilePaths(input) {
  const toolInput = input?.tool_input ?? {};
  const filePaths = [];

  if (toolInput.file_path) {
    filePaths.push(String(toolInput.file_path));
  }

  if (toolInput.file) {
    filePaths.push(String(toolInput.file));
  }

  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (edit?.file_path) {
        filePaths.push(String(edit.file_path));
      } else if (edit?.file) {
        filePaths.push(String(edit.file));
      }
    }
  }

  return [...new Set(filePaths.filter(Boolean))];
}

function normalizeToRepoRelative(filePath) {
  const resolved = path.resolve(String(filePath));
  const relative = path.relative(process.cwd(), resolved);

  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }

  return String(filePath).split(path.sep).join("/");
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.resolve(String(filePath)), "utf8");
  } catch {
    return "";
  }
}

function isCodeFile(filePath) {
  return CODE_FILE_EXTENSIONS.test(String(filePath));
}

function isFrontendFile(filePath) {
  return FRONTEND_FILE_EXTENSIONS.test(String(filePath));
}

function getSessionKey(input) {
  const directCandidates = [
    process.env.CODEX_SESSION_ID,
    process.env.CODEX_THREAD_ID,
    process.env.CLAUDE_SESSION_ID,
    input?.thread_id,
    input?.threadId,
    input?.session_id,
    input?.sessionId,
    input?.hookRunId,
    input?.hook_run_id,
  ];

  for (const candidate of directCandidates) {
    const value = typeof candidate === "string" ? candidate.trim() : "";
    if (value) {
      return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    }
  }

  const transcriptPath = input?.transcript_path || input?.transcriptPath;
  if (typeof transcriptPath === "string" && transcriptPath.trim()) {
    return crypto
      .createHash("sha1")
      .update(transcriptPath.trim())
      .digest("hex")
      .slice(0, 12);
  }

  return crypto
    .createHash("sha1")
    .update(process.cwd())
    .digest("hex")
    .slice(0, 12);
}

function getAccumulatorFile(input) {
  return path.join(os.tmpdir(), `helm-codex-edited-${getSessionKey(input)}.txt`);
}

function appendAccumulatorEntry(input, filePath) {
  const normalized = path.resolve(String(filePath));
  fs.appendFileSync(getAccumulatorFile(input), `${normalized}\n`, "utf8");
}

function readAccumulatorEntries(input) {
  try {
    const raw = fs.readFileSync(getAccumulatorFile(input), "utf8");
    return [...new Set(raw.split("\n").map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function clearAccumulator(input) {
  try {
    fs.unlinkSync(getAccumulatorFile(input));
  } catch {
    // Best effort only.
  }
}

function runCli(run) {
  let raw = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    if (raw.length < MAX_STDIN) {
      const remaining = MAX_STDIN - raw.length;
      raw += chunk.substring(0, remaining);
    }
  });

  process.stdin.on("end", () => {
    const result = run(raw);
    if (result.stderr) {
      process.stderr.write(`${result.stderr}\n`);
    }
    if ((result.exitCode ?? 0) !== 2 && typeof result.stdout === "string") {
      process.stdout.write(result.stdout);
    }
    process.exit(Number.isInteger(result.exitCode) ? result.exitCode : 0);
  });
}

module.exports = {
  appendAccumulatorEntry,
  clearAccumulator,
  collectFilePaths,
  getAccumulatorFile,
  isCodeFile,
  isFrontendFile,
  makeHookAdditionalContextResult,
  makeResult,
  makeSystemMessageResult,
  normalizeToRepoRelative,
  parseInput,
  readAccumulatorEntries,
  readFile,
  runCli,
  toRawString,
};
