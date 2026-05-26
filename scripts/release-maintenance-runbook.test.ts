import { describe, expect, it } from "vitest";
import { STEPS, buildFreshRunbookState, type StepSpec } from "./release-maintenance-runbook";

describe("release-maintenance-runbook canonical step contract", () => {
  it("has the exact 13 canonical steps in fixed order", () => {
    const expectedIds = [
      "preflight",
      "rotation-confirm",
      "rehearsal-mirror",
      "collaborator-freeze",
      "real-rewrite",
      "force-push",
      "post-rewrite-verify",
      "post-rewrite-grep",
      "mirror-build",
      "mirror-verify",
      "clean-receipt",
      "release-check",
      "go-nogo",
    ];
    expect(STEPS.map((s) => s.id)).toEqual(expectedIds);
  });

  it("has unique step IDs (no accidental duplication on edit)", () => {
    const ids = STEPS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("classifies every step as manual / verify / orchestrate (no untyped step slips in)", () => {
    const allowed = new Set<StepSpec["kind"]>(["manual", "verify", "orchestrate"]);
    for (const s of STEPS) {
      expect(allowed.has(s.kind), `step ${s.id} has invalid kind: ${s.kind}`).toBe(true);
    }
  });

  it("places destructive steps as manual (never auto-orchestrated)", () => {
    // Force-push, history rewrite, collaborator freeze, RDS credential
    // rotation — these must NEVER be classified as orchestrate or verify,
    // because the runbook MUST require human confirmation. If a future edit
    // demotes any of these to orchestrate, this test catches it.
    const destructiveSteps = ["rotation-confirm", "real-rewrite", "force-push", "collaborator-freeze"];
    for (const id of destructiveSteps) {
      const step = STEPS.find((s) => s.id === id);
      expect(step, `expected step "${id}" to exist`).toBeDefined();
      expect(step!.kind, `step "${id}" must be kind=manual`).toBe("manual");
    }
  });

  it("places verify steps after their preconditions (sequence sanity)", () => {
    const indexOf = (id: string) => STEPS.findIndex((s) => s.id === id);

    // post-rewrite-verify must come AFTER force-push (verify the push worked)
    expect(indexOf("post-rewrite-verify")).toBeGreaterThan(indexOf("force-push"));

    // release-check must come AFTER mirror-build / mirror-verify / clean-receipt
    expect(indexOf("release-check")).toBeGreaterThan(indexOf("mirror-build"));
    expect(indexOf("release-check")).toBeGreaterThan(indexOf("mirror-verify"));
    expect(indexOf("release-check")).toBeGreaterThan(indexOf("clean-receipt"));

    // go-nogo (final signoff) must be LAST
    expect(indexOf("go-nogo")).toBe(STEPS.length - 1);

    // preflight must be FIRST
    expect(indexOf("preflight")).toBe(0);
  });
});

describe("release-maintenance-runbook buildFreshRunbookState", () => {
  it("initializes runId, startedAt, currentStepIndex=0, all steps pending", () => {
    const state = buildFreshRunbookState("test-run-001", false, "2026-05-19T00:00:00.000Z");
    expect(state.runId).toBe("test-run-001");
    expect(state.startedAt).toBe("2026-05-19T00:00:00.000Z");
    expect(state.currentStepIndex).toBe(0);
    expect(state.ownerConfirmedAt).toBeNull();
    expect(state.dryRun).toBe(false);
    expect(state.steps).toHaveLength(STEPS.length);
    for (const evidence of state.steps) {
      expect(evidence.status).toBe("pending");
      expect(evidence.startedAt).toBeNull();
      expect(evidence.finishedAt).toBeNull();
      expect(evidence.notes).toEqual([]);
      expect(evidence.commandsRun).toEqual([]);
    }
  });

  it("honors dryRun flag", () => {
    const wet = buildFreshRunbookState("r1", false);
    const dry = buildFreshRunbookState("r2", true);
    expect(wet.dryRun).toBe(false);
    expect(dry.dryRun).toBe(true);
  });

  it("populates step evidence titles from STEPS (no drift)", () => {
    const state = buildFreshRunbookState("r3", false);
    for (let i = 0; i < STEPS.length; i += 1) {
      expect(state.steps[i].stepId).toBe(STEPS[i].id);
      expect(state.steps[i].title).toBe(STEPS[i].title);
    }
  });

  it("uses a fresh array for steps (no shared mutable reference across builds)", () => {
    const s1 = buildFreshRunbookState("r4", false);
    const s2 = buildFreshRunbookState("r5", false);
    // Mutating one must not affect the other.
    s1.steps[0].notes.push("only in s1");
    expect(s2.steps[0].notes).toEqual([]);
  });

  it("uses fresh nested arrays for notes + commandsRun (no shared reference)", () => {
    const s1 = buildFreshRunbookState("r6", false);
    s1.steps[0].notes.push("note");
    s1.steps[0].commandsRun.push({ command: "x", exitCode: 0, capturedAt: "t" });
    const s2 = buildFreshRunbookState("r7", false);
    expect(s2.steps[0].notes).toEqual([]);
    expect(s2.steps[0].commandsRun).toEqual([]);
  });
});

describe("release-maintenance-runbook coverage of T010 evidence checklist", () => {
  // T010 Go/No-Go evidence checklist has 6 items. The runbook must
  // produce evidence for items 1, 2, 3, and 5; items 4 (public surface
  // signoff) and 6 (backup owner availability) are documented outside
  // this runbook (human-only signoff).
  it("covers T010 item 1 (RDS rotation)", () => {
    expect(STEPS.find((s) => s.id === "rotation-confirm")).toBeDefined();
  });

  it("covers T010 item 2 (secret history remediation full chain)", () => {
    expect(STEPS.find((s) => s.id === "rehearsal-mirror")).toBeDefined();
    expect(STEPS.find((s) => s.id === "real-rewrite")).toBeDefined();
    expect(STEPS.find((s) => s.id === "force-push")).toBeDefined();
    expect(STEPS.find((s) => s.id === "post-rewrite-verify")).toBeDefined();
    expect(STEPS.find((s) => s.id === "post-rewrite-grep")).toBeDefined();
  });

  it("covers T010 item 3 (mirror clean receipt + release:check)", () => {
    expect(STEPS.find((s) => s.id === "mirror-build")).toBeDefined();
    expect(STEPS.find((s) => s.id === "mirror-verify")).toBeDefined();
    expect(STEPS.find((s) => s.id === "clean-receipt")).toBeDefined();
    expect(STEPS.find((s) => s.id === "release-check")).toBeDefined();
  });

  it("ends with go-nogo signoff (T010 item Go decision record)", () => {
    expect(STEPS[STEPS.length - 1].id).toBe("go-nogo");
  });
});
