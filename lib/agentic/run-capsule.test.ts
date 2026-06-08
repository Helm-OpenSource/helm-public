import { describe, it, expect } from "vitest";
import {
  agentRunCapsuleSchema,
  buildAgentRunCapsule,
  validateCapsuleWithinPublicCore,
  type BuildAgentRunCapsuleInput,
} from "./run-capsule";
import { runSarpReview } from "./sarp-eval";

const fixedNow = () => new Date("2026-06-07T00:00:00.000Z");

function baseInput(overrides: Partial<BuildAgentRunCapsuleInput> = {}): BuildAgentRunCapsuleInput {
  return {
    runId: "run-1",
    actor: "agent-alias",
    mode: "explore",
    worktreeProfile: "read_only_local",
    repo: { alias: "helm-console", branchRef: "main", dirtyState: "unknown" },
    intent: "inspect diagnostics",
    redactionStatus: "redacted",
    commandResults: [
      {
        name: "check:public-docs",
        args: [],
        cwd: "<cwd>",
        risk: "read",
        exitCode: 0,
        startedAt: "2026-06-07T00:00:00.000Z",
        endedAt: "2026-06-07T00:00:01.000Z",
        outputSummary: "ok",
      },
    ],
    now: fixedNow,
    ...overrides,
  };
}

describe("buildAgentRunCapsule", () => {
  it("builds a valid, candidate-only capsule with no approval claim", () => {
    const capsule = buildAgentRunCapsule(baseInput());
    expect(() => agentRunCapsuleSchema.parse(capsule)).not.toThrow();
    expect(capsule.quarantined).toBe(false);
    expect(capsule.nextSafeActions.join(" ")).toMatch(/human review/i);
    const json = JSON.stringify(capsule);
    expect(json).not.toMatch(/accepted_by_human|approved|release[- ]?ready/i);
  });

  it("redacts paths/emails/credentials in free-text", () => {
    const secretPath = ["/Users", "alice", "secret"].join("/");
    const cred = ["mysql://root", "pw@db/x"].join(":");
    const capsule = buildAgentRunCapsule(
      baseInput({
        intent: `look at ${secretPath} for ${["bob", "example.com"].join("@")} via ${cred}`,
      }),
    );
    expect(capsule.intent).not.toContain(secretPath);
    expect(capsule.intent).toContain("<path>");
    expect(capsule.intent).not.toContain("root:pw@db");
  });

  it("quarantines and withholds content when redaction is unproven", () => {
    const capsule = buildAgentRunCapsule(
      baseInput({
        redactionStatus: "unknown",
        intent: "raw secret content",
        inputRefs: ["/Users/alice/raw"],
        outputArtifacts: ["/tmp/raw.json"],
      }),
    );
    expect(capsule.quarantined).toBe(true);
    expect(capsule.intent).toBe("<quarantined>");
    expect(capsule.inputRefs).toEqual([]);
    expect(capsule.outputArtifacts).toEqual([]);
    expect(capsule.boundaryDecisions.some((b) => b.decision === "quarantine")).toBe(true);
    expect(capsule.nextSafeActions.join(" ")).toMatch(/quarantined/i);
  });

  it("rejects a command result that declares a forbidden risk", () => {
    expect(() =>
      buildAgentRunCapsule(
        baseInput({
          commandResults: [
            {
              name: "send",
              args: [],
              cwd: "<cwd>",
              risk: "external_write",
              exitCode: 0,
              startedAt: "t",
              endedAt: "t",
              outputSummary: "x",
            },
          ],
        }),
      ),
    ).toThrow(/forbidden risk/);
  });

  it("accepts an optional SARP review receipt for the same run", () => {
    const capsule = buildAgentRunCapsule(baseInput());
    const sarpReceipt = runSarpReview(capsule, { now: fixedNow });
    expect(() => agentRunCapsuleSchema.parse({ ...capsule, sarpReceipt })).not.toThrow();
  });

  it("rejects a SARP review receipt from a different run", () => {
    const capsule = buildAgentRunCapsule(baseInput());
    const otherCapsule = buildAgentRunCapsule(baseInput({ runId: "run-2" }));
    const sarpReceipt = runSarpReview(otherCapsule, { now: fixedNow });
    expect(() => agentRunCapsuleSchema.parse({ ...capsule, sarpReceipt })).toThrow(
      /sarpReceipt.capsuleRunId must match runId/,
    );
  });
});

describe("validateCapsuleWithinPublicCore", () => {
  it("flags a forbidden-risk command, unquarantined unproven redaction, and unreviewed repo_write", () => {
    const capsule = agentRunCapsuleSchema.parse({
      runId: "r",
      createdAt: "2026-06-07T00:00:00.000Z",
      actor: "a",
      mode: "implement",
      worktreeProfile: "read_only_local",
      repo: { alias: "x", branchRef: "y", dirtyState: "clean" },
      intent: "",
      redactionStatus: "unknown",
      quarantined: false,
      commandResults: [
        { name: "w", args: [], cwd: "<cwd>", risk: "repo_write", exitCode: 0, startedAt: "t", endedAt: "t", outputSummary: "" },
        { name: "x", args: [], cwd: "<cwd>", risk: "activation", exitCode: 0, startedAt: "t", endedAt: "t", outputSummary: "" },
      ],
    });
    const rules = validateCapsuleWithinPublicCore(capsule).map((v) => v.rule);
    expect(rules).toContain("forbidden-risk-command");
    expect(rules).toContain("unproven-redaction-not-quarantined");
    expect(rules).toContain("repo-write-needs-reviewed-worktree");
  });

  it("passes a clean read-only capsule", () => {
    expect(validateCapsuleWithinPublicCore(buildAgentRunCapsule(baseInput()))).toEqual([]);
  });
});
