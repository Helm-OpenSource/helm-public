import { afterEach, describe, expect, it } from "vitest";

import { assertCaioOperatingContextPack, type CaioDetector } from "@/lib/caio-operating-context/contracts";

import type { CaioAttentionRouteRule } from "./contracts";
import { buildCaioDetectorEvaluations, CAIO_ATTENTION_GENERATOR_ENABLED_ENV, isCaioAttentionGeneratorEnabled } from "./detector-evaluation";
import { planCaioAttentionGeneration, type CaioAttentionLiveCase } from "./generator-plan";
import {
  findCaioAttentionRouteRule, getRegisteredCaioAttentionPack, registerCaioAttentionPack, resetCaioAttentionPackForTests,
  resolveCaioAttentionEnterpriseScope,
} from "./registry";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "./schedule";

const detector = (detectorId: string, ruleVersion?: string): CaioDetector => ({
  detectorId, title: { zh: "测试", en: "Test" }, requiredTemplateIds: ["t"], evaluate: () => [], ...(ruleVersion ? { ruleVersion } : {}),
});
const rule = (overrides: Partial<CaioAttentionRouteRule> = {}): CaioAttentionRouteRule => ({
  detectorId: "det-a", category: "business", primaryRoleKey: "lead", primaryFallbackRoleKeys: ["result_owner"], ccRoleKeys: ["helper"],
  escalationRoleKey: "result_owner", escalationFallbackRoleKey: "ws_owner", reviewerRoleKey: "result_owner",
  reviewerFallbackRoleKey: "ws_owner", compatibleRuleVersions: ["v1"], committedDue: "suggest", ...overrides,
});

afterEach(() => {
  resetCaioAttentionPackForTests();
  delete process.env[CAIO_ATTENTION_GENERATOR_ENABLED_ENV];
});

describe("detector rule version contract", () => {
  it("accepts detectors with and without a rule version, and rejects a malformed one", () => {
    const templates = [{ templateId: "t", domain: "ops", sourceKey: "s", run: async () => null }];
    expect(() => assertCaioOperatingContextPack({ templates, detectors: [detector("a", "v1"), detector("b")] })).not.toThrow();
    expect(() => assertCaioOperatingContextPack({ templates, detectors: [detector("a", "bad version")] }))
      .toThrow("detector_rule_version_invalid");
  });
});

describe("buildCaioDetectorEvaluations", () => {
  const base = { workspaceId: "ws", tickId: "tick", bucketStart: new Date("2026-01-05T02:00:00Z") };
  it("records HIT / NO_HIT / SKIPPED / FAILED per registered detector with sorted, distinct merge keys", () => {
    const hit = (mergeKey: string) => ({ mergeKey, objectKey: "o", severity: "warning" as const, reasonCode: "r", evidenceTemplateIds: ["t"] });
    const rows = buildCaioDetectorEvaluations({
      ...base,
      detectors: [detector("hit", "v2"), detector("quiet", "v1"), detector("unknown", "v1"), detector("broken"), detector("hit", "v9")],
      run: {
        evaluated: [{ detectorId: "hit", hits: [hit("m:b"), hit("m:a")] }, { detectorId: "quiet", hits: [] }],
        skipped: [{ detectorId: "unknown", reason: "input_unknown" }],
        failed: [{ detectorId: "broken", reason: "detector_threw" }],
      },
    });
    expect(rows.map(({ detectorId, ruleVersion, outcome, hitMergeKeysJson }) => [detectorId, ruleVersion, outcome, hitMergeKeysJson])).toEqual([
      ["hit", "v2", "HIT", "[\"m:a\",\"m:b\"]"],
      ["quiet", "v1", "NO_HIT", "[]"],
      ["unknown", "v1", "SKIPPED", "[]"],
      ["broken", "", "FAILED", "[]"],
    ]);
    expect(rows[0]).toMatchObject(base);
  });

  it("is off unless the switch is exactly \"true\"", () => {
    expect(isCaioAttentionGeneratorEnabled()).toBe(false);
    for (const value of ["1", "TRUE", "yes"]) {
      process.env[CAIO_ATTENTION_GENERATOR_ENABLED_ENV] = value;
      expect(isCaioAttentionGeneratorEnabled()).toBe(false);
    }
    process.env[CAIO_ATTENTION_GENERATOR_ENABLED_ENV] = "true";
    expect(isCaioAttentionGeneratorEnabled()).toBe(true);
  });
});

describe("planCaioAttentionGeneration", () => {
  const live = (overrides: Partial<CaioAttentionLiveCase> = {}): CaioAttentionLiveCase => ({
    id: "case-1", originCandidateId: "cand-1", effectiveSeverity: "warning", candidateRecurred: false, severityRaisePending: false, ...overrides,
  });
  const plan = (input: Partial<Parameters<typeof planCaioAttentionGeneration>[0]>) =>
    planCaioAttentionGeneration({ candidateId: "cand-1", severity: "warning", liveCase: null, candidateConsumed: false, ...input });

  it("creates a suggestion only for an unused candidate with no live case on the signal", () => {
    expect(plan({})).toEqual({ kind: "create" });
    expect(plan({ candidateConsumed: true })).toEqual({ kind: "skip", reason: "candidate_consumed" });
  });

  it("T-G5: a persisting origin candidate appends nothing; a new candidate on the live signal recurs once", () => {
    expect(plan({ liveCase: live() })).toEqual({ kind: "skip", reason: "already_attached" });
    expect(plan({ candidateId: "cand-2", liveCase: live() })).toEqual({ kind: "attach", caseId: "case-1", recur: true, raise: false });
    expect(plan({ candidateId: "cand-2", liveCase: live({ candidateRecurred: true }) })).toEqual({ kind: "skip", reason: "already_attached" });
  });

  it("raises a warning case once when a critical hit arrives, from the origin or a recurrence", () => {
    expect(plan({ severity: "critical", liveCase: live() })).toEqual({ kind: "attach", caseId: "case-1", recur: false, raise: true });
    expect(plan({ candidateId: "cand-2", severity: "critical", liveCase: live() })).toEqual({ kind: "attach", caseId: "case-1", recur: true, raise: true });
    expect(plan({ severity: "critical", liveCase: live({ severityRaisePending: true }) })).toEqual({ kind: "skip", reason: "already_attached" });
    expect(plan({ severity: "critical", liveCase: live({ effectiveSeverity: "critical" }) })).toEqual({ kind: "skip", reason: "already_attached" });
  });
});

describe("attention pack registry", () => {
  it("registers one validated pack per process and finds rules by detector and reason", () => {
    expect(getRegisteredCaioAttentionPack()).toBeNull();
    expect(() => registerCaioAttentionPack({ packId: "p", policy: { ...policy, consecutiveBuckets: { warning: 0, critical: 1 } }, rules: [] }))
      .toThrow("caio_attention_policy_invalid");
    expect(() => registerCaioAttentionPack({ packId: "p", policy, rules: [rule({ ccRoleKeys: ["lead"] })] }))
      .toThrow("caio_attention_route_rule_invalid");
    const rules = [rule({ reasonCodes: ["only_this"] }), rule({ category: "technical" })];
    registerCaioAttentionPack({ packId: "p", policy, rules });
    expect(() => registerCaioAttentionPack({ packId: "q", policy, rules })).toThrow("caio_attention_pack_already_registered");
    expect(findCaioAttentionRouteRule(rules, "det-a", "only_this")).toBe(rules[0]);
    expect(findCaioAttentionRouteRule(rules, "det-a", "other")).toBe(rules[1]);
    expect(findCaioAttentionRouteRule(rules, "det-b", "other")).toBeNull();
  });

  it("treats an enterprise suffix as unverified without a hook or when the hook fails", async () => {
    const pack = { packId: "p", policy, rules: [] };
    await expect(resolveCaioAttentionEnterpriseScope(pack, "ws", null)).resolves.toBe("not_applicable");
    await expect(resolveCaioAttentionEnterpriseScope(pack, "ws", "ent-a")).resolves.toBe("unverified");
    const hooked = { ...pack, verifyEnterpriseScope: async ({ slug }: { slug: string }) => { if (slug === "boom") throw new Error("x"); return slug === "ent-a"; } };
    expect(await Promise.all(["ent-a", "ent-b", "boom"].map((slug) => resolveCaioAttentionEnterpriseScope(hooked, "ws", slug))))
      .toEqual(["verified", "unverified", "unverified"]);
  });
});
