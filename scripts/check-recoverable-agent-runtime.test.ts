import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runRecoverableAgentRuntimeCheck } from "./check-recoverable-agent-runtime";

const REQUIRED_FILES = [
  "lib/agent-runtime/recoverable-runner.ts",
  "lib/agent-runtime/recoverable-run-store.ts",
  "lib/agent-runtime/recoverable-run-store-mysql.ts",
  "lib/agent-runtime/agent-run-store-schema.sql",
  "lib/agent-runtime/agent-run-store-recoverable-migration.sql",
] as const;

function copyRuntimeFixture(repoRoot: string): void {
  for (const relativePath of REQUIRED_FILES) {
    const destination = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      readFileSync(path.join(process.cwd(), relativePath), "utf8"),
    );
  }
}

function withRuntimeFixture(
  mutate: (repoRoot: string) => void,
): ReturnType<typeof runRecoverableAgentRuntimeCheck> {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "recoverable-runtime-guard-"));
  try {
    copyRuntimeFixture(repoRoot);
    mutate(repoRoot);
    return runRecoverableAgentRuntimeCheck(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("recoverable agent runtime boundary guard", () => {
  it("passes on the repository runtime", () => {
    expect(runRecoverableAgentRuntimeCheck(process.cwd())).toEqual({
      ok: true,
      violations: [],
    });
  });

  it("rejects non-read invocation and business side-effect imports", () => {
    const result = withRuntimeFixture((repoRoot) => {
      const runnerPath = path.join(
        repoRoot,
        "lib/agent-runtime/recoverable-runner.ts",
      );
      const source = readFileSync(runnerPath, "utf8")
        .replace(
          'canInvokeTool: (tool) => tool.riskLevel === "read"',
          "canInvokeTool: () => true",
        )
        .concat('\nimport { runCrmImport } from "@/lib/imports/crm-orchestrator.service";\n');
      writeFileSync(runnerPath, source);
    });

    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(["RECOVERABLE-RUNTIME-A", "RECOVERABLE-RUNTIME-B"]),
    );
  });

  it("rejects weakened lease, heartbeat, retry, transaction, or fencing markers", () => {
    const result = withRuntimeFixture((repoRoot) => {
      const storePath = path.join(
        repoRoot,
        "lib/agent-runtime/recoverable-run-store.ts",
      );
      writeFileSync(
        storePath,
        readFileSync(storePath, "utf8")
          .replace("60_000 as const", "120_000 as const")
          .replace("20_000 as const", "40_000 as const")
          .replace("3 as const", "5 as const"),
      );

      const mysqlPath = path.join(
        repoRoot,
        "lib/agent-runtime/recoverable-run-store-mysql.ts",
      );
      writeFileSync(
        mysqlPath,
        readFileSync(mysqlPath, "utf8")
          .replaceAll("$transaction", "transactionWithoutLock")
          .replaceAll("FOR UPDATE", ""),
      );
    });

    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(["RECOVERABLE-RUNTIME-C", "RECOVERABLE-RUNTIME-D"]),
    );
  });

  it("rejects incomplete fresh-schema or migration recovery controls", () => {
    const result = withRuntimeFixture((repoRoot) => {
      for (const relativePath of [
        "lib/agent-runtime/agent-run-store-schema.sql",
        "lib/agent-runtime/agent-run-store-recoverable-migration.sql",
      ]) {
        const file = path.join(repoRoot, relativePath);
        writeFileSync(
          file,
          readFileSync(file, "utf8")
            .replaceAll("fencing_epoch", "removed_epoch")
            .replaceAll("checkpoint_ref", "removed_checkpoint"),
        );
      }
    });

    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(["RECOVERABLE-RUNTIME-E"]),
    );
  });
});
