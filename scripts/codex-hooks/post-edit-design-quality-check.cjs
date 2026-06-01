/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const {
  collectFilePaths,
  isFrontendFile,
  makeResult,
  makeSystemMessageResult,
  normalizeToRepoRelative,
  parseInput,
  readFile,
  runCli,
} = require("./shared.cjs");

const SIGNALS = [
  { pattern: /\bbg-gradient-to-[trblxy]/, label: "gradient-led hero/container treatment" },
  { pattern: /\b(?:from|via|to)-(?:violet|purple|fuchsia|pink|indigo)-/i, label: "purple / neon accent ramp" },
  { pattern: /\bbackdrop-blur(?:-[a-z0-9]+)?\b/, label: "glassmorphism / backdrop blur" },
  { pattern: /\bshadow-2xl\b/, label: "heavy shadow styling" },
  { pattern: /\bdark:/, label: "dark-mode utility usage" },
  { pattern: /\btext-center\b/, label: "centered default layout cue" },
  { pattern: /\b(?:Get Started|Learn More)\b/i, label: "generic CTA copy" },
  { pattern: /\b(?:chat|prompt)\b/i, label: "chat-first / prompt-first wording" },
];

const CHECKLIST = [
  "light-first, not dark-mode-first",
  "judgement / evidence / action / boundary hierarchy stays visible",
  "shared tokens should come from app/globals.css rather than one-off page styling",
  "avoid purple-neon gradients, glassmorphism, and heavy shadow dressing",
  "avoid chat-first hero or prompt-box-centered framing",
];

function detectSignals(content) {
  return SIGNALS.filter((signal) => signal.pattern.test(content)).map((signal) => signal.label);
}

function buildWarning(frontendPaths, findings) {
  const fileLines = frontendPaths.map((filePath) => `  - ${filePath}`).join("\n");
  const findingLines =
    findings.length > 0
      ? [...new Set(findings)].map((finding) => `  - ${finding}`).join("\n")
      : "  - no obvious DESIGN.md drift heuristics fired";

  return [
    "[Hook] DESIGN CHECK: frontend file(s) modified:",
    fileLines,
    "[Hook] Re-check against DESIGN.md before closeout:",
    CHECKLIST.map((item) => `  - ${item}`).join("\n"),
    "[Hook] Heuristic signals:",
    findingLines,
  ].join("\n");
}

function run(inputOrRaw) {
  const input = parseInput(inputOrRaw);
  const frontendPaths = collectFilePaths(input)
    .filter((filePath) => isFrontendFile(filePath))
    .map((filePath) => normalizeToRepoRelative(filePath));

  if (frontendPaths.length === 0) {
    return makeResult();
  }

  const findings = [];
  for (const filePath of frontendPaths) {
    findings.push(...detectSignals(readFile(filePath)));
  }

  return makeSystemMessageResult(buildWarning(frontendPaths, findings));
}

module.exports = { run };

if (require.main === module) {
  runCli(run);
}
