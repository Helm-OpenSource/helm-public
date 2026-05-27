import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import sampleBundle from "@/evals/operating-signal-flow/runtime-readiness-bundle.sample.json";
import {
  OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES,
  runOperatingSignalFlowRuntimeReadinessIntake,
  stringifyOperatingSignalFlowRuntimeReadinessIntakeResult,
  type OperatingSignalFlowRuntimeReadinessIntakeInput,
} from "@/lib/evals/operating-signal-flow-runtime-readiness-intake";

describe("operating signal flow runtime readiness intake", () => {
  it("passes the checked-in alias-only sample and emits a wrapped replay pack", () => {
    const result = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(sampleInput()),
    );

    expect(result.preflight).toBe("pass");
    expect(result.readinessDecision).toBe("go");
    expect(result.exitCode).toBe(0);
    expect(result.inputDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.caseResult?.assertionFailures).toEqual([]);
    expect(result.wrappedPack?.status).toBe("offline_intake_screen_only");
    expect(result.wrappedPack?.cases[0]?.expectedDecision).toBe("go");
  });

  it("keeps stable semantic digest and output for reordered top-level keys", () => {
    const input = sampleInput();
    const reordered = {
      reviewBundle: input.reviewBundle,
      casePurpose: input.casePurpose,
      evaluatedAt: input.evaluatedAt,
      caseId: input.caseId,
      schemaVersion: input.schemaVersion,
    };

    const first = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(input),
    );
    const second = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(reordered),
    );

    expect(second.inputDigest).toBe(first.inputDigest);
    expect(
      stringifyOperatingSignalFlowRuntimeReadinessIntakeResult(second),
    ).toBe(stringifyOperatingSignalFlowRuntimeReadinessIntakeResult(first));
  });

  it("fails preflight for sensitive keys before readiness evaluation", () => {
    const input = sampleInput();
    input.reviewBundle.redactedSnapshotProjection.fieldSamples.customerEmail =
      "alias_customer_001";

    const result = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(input),
    );

    expect(result.preflight).toBe("fail");
    expect(result.exitCode).toBe(2);
    expect(result.inputDigest).toBe("withheld_sensitive_preflight");
    expect(result.readinessDecision).toBe("not_evaluated");
    expect(result.caseResult).toBeNull();
    expect(result.findings.map((item) => item.code)).toContain(
      "sensitive_key_detected",
    );
    expect(result.findings.map((item) => item.path)).toContain(
      "$.reviewBundle.redactedSnapshotProjection.fieldSamples.customerEmail",
    );
  });

  it("fails preflight for raw value patterns in nested arrays and strings", () => {
    const input = {
      ...sampleInput(),
      casePurpose:
        "Synthetic bundle accidentally contains alias@example.com and 138-0013-8000.",
    };
    const withNestedPhone = {
      ...input,
      reviewBundle: {
        ...input.reviewBundle,
        evidenceRefs: [
          ...input.reviewBundle.evidenceRefs,
          ["13800138000"] as never,
        ],
      },
    };

    const result = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(withNestedPhone),
    );

    expect(result.preflight).toBe("fail");
    expect(result.exitCode).toBe(2);
    expect(result.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["raw_email_pattern", "raw_phone_pattern"]),
    );
  });

  it("fails preflight for bearer tokens and provider API key patterns", () => {
    const input = {
      ...sampleInput(),
      casePurpose:
        "Synthetic bundle accidentally contains Bearer abcdefghijklmnopqrstuvwxyz and sk-abcdefghijklmnopqrstuvwx.",
    };

    const result = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(input),
    );

    expect(result.preflight).toBe("fail");
    expect(result.exitCode).toBe(2);
    expect(result.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["raw_bearer_token_pattern", "raw_api_key_pattern"]),
    );
  });

  it("returns deterministic JSON with exit 64 for directory input paths", () => {
    const cli = spawnSync(
      process.execPath,
      [
        "--import",
        path.join(process.cwd(), "node_modules/tsx/dist/loader.mjs"),
        "scripts/operating-signal-flow-runtime-readiness-intake.ts",
        "--input",
        ".",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    const output = JSON.parse(cli.stdout);

    expect(cli.status).toBe(64);
    expect(cli.stderr).toBe("");
    expect(output.exitCode).toBe(64);
    expect(output.findings[0]?.code).toBe("invalid_json");
  });

  it("returns readiness hold exit code when preflight passes but required approval is missing", () => {
    const input = sampleInput();
    input.reviewBundle.reviews.executiveSponsorApproval.status = "missing";
    input.reviewBundle.reviews.executiveSponsorApproval.approvedAt = null;

    const result = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(input),
    );

    expect(result.preflight).toBe("pass");
    expect(result.readinessDecision).toBe("defer");
    expect(result.exitCode).toBe(3);
    expect(result.readinessFailures.map((item) => item.code)).toContain(
      "executive_sponsor_approval_missing",
    );
    expect(result.wrappedPack?.cases[0]?.expectedDecision).toBe("defer");
  });

  it("returns input exit code for malformed, oversized, unknown-key and over-depth inputs", () => {
    const malformed = runOperatingSignalFlowRuntimeReadinessIntake("{");
    const oversized = runOperatingSignalFlowRuntimeReadinessIntake(
      " ".repeat(OPERATING_SIGNAL_FLOW_RUNTIME_READINESS_INTAKE_MAX_BYTES + 1),
    );
    const unknownKey = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify({ ...sampleInput(), extraAlias: "safe_alias" }),
    );
    const overDepth = runOperatingSignalFlowRuntimeReadinessIntake(
      JSON.stringify(deepInput()),
    );

    expect(malformed.exitCode).toBe(64);
    expect(malformed.findings[0]?.code).toBe("invalid_json");
    expect(oversized.exitCode).toBe(64);
    expect(oversized.findings[0]?.code).toBe("input_too_large");
    expect(unknownKey.exitCode).toBe(64);
    expect(unknownKey.findings[0]?.code).toBe("unknown_top_level_key");
    expect(overDepth.exitCode).toBe(64);
    expect(overDepth.findings[0]?.code).toBe("input_depth_limit_exceeded");
  });
});

function sampleInput(): OperatingSignalFlowRuntimeReadinessIntakeInput {
  return JSON.parse(
    JSON.stringify(sampleBundle),
  ) as OperatingSignalFlowRuntimeReadinessIntakeInput;
}

function deepInput() {
  const root: Record<string, unknown> = {};
  let cursor = root;
  for (let index = 0; index < 26; index += 1) {
    cursor.next = {};
    cursor = cursor.next as Record<string, unknown>;
  }
  return root;
}
