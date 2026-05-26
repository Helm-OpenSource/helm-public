import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

const shared = require("../../scripts/codex-hooks/shared.cjs");
const noVerifyHook = require("../../scripts/codex-hooks/pre-bash-block-no-verify.cjs");
const gitPushReminderHook = require("../../scripts/codex-hooks/pre-bash-git-push-reminder.cjs");
const configProtectionHook = require("../../scripts/codex-hooks/pre-edit-config-protection.cjs");
const designCheckHook = require("../../scripts/codex-hooks/post-edit-design-quality-check.cjs");
const debugArtifactCheckHook = require("../../scripts/codex-hooks/post-edit-debug-artifact-check.cjs");
const accumulatorHook = require("../../scripts/codex-hooks/post-edit-accumulator.cjs");
const sessionStartBootstrapHook = require("../../scripts/codex-hooks/session-start-bootstrap.cjs");
const stopReminderHook = require("../../scripts/codex-hooks/stop-validation-reminder.cjs");

describe("codex hook guardrails", () => {
  const createdDirs: string[] = [];
  const previousSessionId = process.env.CODEX_SESSION_ID;

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }

    for (const sessionId of [process.env.CODEX_SESSION_ID, previousSessionId, "helm-guardrail-test"]) {
      if (!sessionId) {
        continue;
      }

      process.env.CODEX_SESSION_ID = sessionId;
      rmSync(shared.getAccumulatorFile({}), { force: true });
    }

    if (previousSessionId === undefined) {
      delete process.env.CODEX_SESSION_ID;
    } else {
      process.env.CODEX_SESSION_ID = previousSessionId;
    }
  });

  it("blocks git --no-verify", () => {
    const result = noVerifyHook.run(
      JSON.stringify({
        tool_input: {
          command: "git commit --no-verify -m \"docs: test\"",
        },
      }),
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--no-verify");
  });

  it("warns before git push without blocking it", () => {
    const result = gitPushReminderHook.run(
      JSON.stringify({
        tool_input: {
          command: "git push origin main",
        },
      }),
    );
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload.systemMessage).toContain("GIT PUSH REMINDER");
    expect(payload.systemMessage).toContain("remote / branch");
  });

  it("keeps successful pre-tool hooks silent when no intervention is needed", () => {
    const result = noVerifyHook.run(
      JSON.stringify({
        tool_input: {
          command: "git status --short",
        },
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("surfaces dirty worktree and upstream drift in git push reminders", () => {
    const result = gitPushReminderHook.run(
      JSON.stringify({
        tool_input: {
          command: "git push origin main",
        },
      }),
      {
        getRepoState: () => ({
          branch: "main",
          upstream: "origin/main",
          behind: 2,
          dirtyEntries: ["M README.md", "?? scripts/codex-hooks/example.cjs"],
        }),
      },
    );
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload.systemMessage).toContain("dirty worktree");
    expect(payload.systemMessage).toContain("behind origin/main by 2 commit(s)");
  });

  it("blocks protected config edits, including repo-local Codex guardrails", () => {
    const eslintResult = configProtectionHook.run(
      JSON.stringify({
        tool_input: {
          file_path: "eslint.config.mjs",
        },
      }),
    );

    expect(eslintResult.exitCode).toBe(2);
    expect(eslintResult.stderr).toContain("eslint.config.mjs");

    const hooksResult = configProtectionHook.run(
      JSON.stringify({
        tool_input: {
          file_path: ".codex/hooks.json",
        },
      }),
    );

    expect(hooksResult.exitCode).toBe(2);
    expect(hooksResult.stderr).toContain(".codex/hooks.json");
  });

  it("warns when frontend edits drift toward banned DESIGN.md cues", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "helm-codex-hook-"));
    createdDirs.push(dir);

    const filePath = path.join(dir, "landing.tsx");
    writeFileSync(
      filePath,
      [
        "export function Landing() {",
        // eslint-disable-next-line helm-design-tokens/no-raw-tailwind-color -- intentional fixture to exercise the design-check hook
        "  return <div className=\"text-center bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-2xl\" />;",
        "}",
      ].join("\n"),
      "utf8",
    );

    const result = designCheckHook.run(
      JSON.stringify({
        tool_input: {
          file_path: filePath,
        },
      }),
    );
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload.systemMessage).toContain("DESIGN CHECK");
    expect(payload.systemMessage).toContain("gradient-led hero/container treatment");
    expect(payload.systemMessage).toContain("purple / neon accent ramp");
  });

  it("warns when edited code still contains console logs, errors, debugger, or merge-removal TODOs", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "helm-codex-hook-debug-"));
    createdDirs.push(dir);

    const filePath = path.join(dir, "debug.ts");
    writeFileSync(
      filePath,
      [
        "export function debugTrace() {",
        "  console.log('trace');",
        "  console.error('trace');",
        "  debugger;",
        "}",
        "// TODO: remove before merge",
      ].join("\n"),
      "utf8",
    );

    const result = debugArtifactCheckHook.run(
      JSON.stringify({
        tool_input: {
          file_path: filePath,
        },
      }),
    );
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload.systemMessage).toContain("DEBUG ARTIFACT CHECK");
    expect(payload.systemMessage).toContain("console.log");
    expect(payload.systemMessage).toContain("console.error");
    expect(payload.systemMessage).toContain("debugger");
    expect(payload.systemMessage).toContain("TODO remove before merge");
  });

  it("accumulates edited code files and emits a stop-time validation reminder", () => {
    process.env.CODEX_SESSION_ID = "helm-guardrail-test";
    rmSync(shared.getAccumulatorFile({}), { force: true });

    const firstFile = path.join(process.cwd(), "app", "demo", "page.tsx");
    const secondFile = path.join(process.cwd(), "features", "dashboard", "queries.ts");

    accumulatorHook.run(
      JSON.stringify({
        tool_input: {
          file_path: firstFile,
        },
      }),
    );

    accumulatorHook.run(
      JSON.stringify({
        tool_input: {
          edits: [{ file_path: secondFile }],
        },
      }),
    );

    const result = stopReminderHook.run("{}");
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload.systemMessage).toContain("STOP VALIDATION");
    expect(payload.systemMessage).toContain("npm run lint");
    expect(payload.systemMessage).toContain("npm run typecheck");
    expect(shared.readAccumulatorEntries({})).toHaveLength(0);
  });

  it("keeps stop-hook stdout empty when there are no accumulated edits", () => {
    process.env.CODEX_SESSION_ID = "helm-guardrail-test";
    rmSync(shared.getAccumulatorFile({}), { force: true });

    const result = stopReminderHook.run("{}");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("prints a narrow Helm session-start bootstrap reminder", () => {
    const result = sessionStartBootstrapHook.run("{}");
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(payload.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(payload.hookSpecificOutput.additionalContext).toContain("HELM SESSION START");
    expect(payload.hookSpecificOutput.additionalContext).toContain("AGENTS.md");
    expect(payload.hookSpecificOutput.additionalContext).toContain("DESIGN.md");
  });
});
