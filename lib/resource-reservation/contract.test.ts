import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeResourceVector, resourceVectorDigest, normalizeReserveRequest, normalizeReleaseRequest, validateReserveRequest } from "./contract";

const a = { scopeRef: "resource:a", generation: 1, units: 2 };
const b = { scopeRef: "resource:b", generation: 3, units: 1 };
const reserve = () => ({ operationRef: "operation:a", topologyRevision: "revision:a", requirements: [a] });
const release = () => ({ operationRef: "operation:a", scopeRefs: [b.scopeRef, a.scopeRef], proofRef: "proof:a", claimGeneration: 1 });

describe("resource reservation wire contract", () => {
  it("sorts ASCII scopes, deduplicates identical demands without doubling and freezes copies", () => {
    const input = [b, a, { ...a }];
    const result = normalizeResourceVector(input);
    expect(result).toEqual([a, b]);
    expect(input).toEqual([b, a, a]);
    expect(result[0]).not.toBe(a);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });
  it.each([{ ...a, units: 1 }, { ...a, generation: 2 }])("rejects conflicting duplicate %j", (other) => {
    expect(() => normalizeResourceVector([a, other])).toThrow("resource_vector_conflict");
  });
  it.each([0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null])("rejects invalid quantities/generations %j", (value) => {
    expect(() => normalizeResourceVector([{ ...a, units: value }])).toThrow();
    expect(() => normalizeResourceVector([{ ...a, generation: value }])).toThrow();
  });
  it("accepts maximum safe integer without summing repeated demand", () => {
    expect(normalizeResourceVector([{ ...a, units: Number.MAX_SAFE_INTEGER }])[0].units).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each(["", " resource:a", "resource:a\n", "ré:source", "a/b", "a".repeat(129)])("rejects noncanonical reference %j", (scopeRef) => {
    expect(() => normalizeResourceVector([{ ...a, scopeRef }])).toThrow();
  });
  it.each([null, {}, [], [a, undefined], new Array(2), [Object.assign(Object.create(a), {})], [{ ...a, extra: true }], [{ ...a, [Symbol("hidden")]: 1 }]])("rejects malformed vector %j", (value) => {
    expect(() => normalizeResourceVector(value)).toThrow();
  });
  it("rejects accessors without invoking them", () => {
    let calls = 0;
    const item = Object.defineProperty({ generation: 1, units: 1 }, "scopeRef", { enumerable: true, get() { calls++; return a.scopeRef; } });
    expect(() => normalizeResourceVector([item])).toThrow();
    expect(calls).toBe(0);
    const array = [a];
    Object.defineProperty(array, "0", { get() { calls++; return a; } });
    expect(() => normalizeResourceVector(array)).toThrow();
    expect(calls).toBe(0);
  });
  it("rejects decorated arrays and non-enumerable unknown properties", () => {
    expect(() => normalizeResourceVector(Object.assign([a], { extra: 1 }))).toThrow();
    expect(() => normalizeResourceVector([Object.defineProperty({ ...a }, "hidden", { value: 1 })])).toThrow();
  });
  it("digest is version/domain separated, stable across order/duplicate/key order and sensitive to demand", () => {
    const expected = createHash("sha256").update(JSON.stringify(["helm.resource-vector/v1", [[a.scopeRef, 1, 2], [b.scopeRef, 3, 1]]])).digest("hex");
    expect(resourceVectorDigest([b, a, a])).toBe(expected);
    expect(resourceVectorDigest([{ units: 2, generation: 1, scopeRef: a.scopeRef }, b])).toBe(expected);
    expect(resourceVectorDigest([{ ...a, units: 3 }, b])).not.toBe(expected);
    expect(resourceVectorDigest([{ ...a, generation: 2 }, b])).not.toBe(expected);
  });
  it("builds frozen request with computed digest, never accepts caller digest/unknown fields", () => {
    const result = normalizeReserveRequest(reserve());
    expect(result.vectorDigest).toBe(resourceVectorDigest([a]));
    expect(Object.isFrozen(result)).toBe(true);
    expect(() => normalizeReserveRequest({ ...reserve(), vectorDigest: result.vectorDigest })).toThrow();
    expect(() => normalizeReserveRequest({ ...reserve(), verified: true })).toThrow();
  });
  it.each(["operationRef", "topologyRevision"])("requires valid reserve %s", (key) => {
    expect(() => normalizeReserveRequest({ ...reserve(), [key]: "" })).toThrow();
  });
  it("normalizes release subset without pretending proof reference authenticates evidence", () => {
    const result = normalizeReleaseRequest({ ...release(), scopeRefs: [b.scopeRef, a.scopeRef, a.scopeRef] });
    expect(result.scopeRefs).toEqual([a.scopeRef, b.scopeRef]);
    expect(result.proofRef).toBe("proof:a");
    expect(Object.isFrozen(result.scopeRefs)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });
  it.each([{ proofRef: "" }, { scopeRefs: [] }, { claimGeneration: 0 }, { deadline: 1 }, { status: "unknown" }, { scopeRefs: [a.scopeRef, null] }])("rejects invalid/unspecified release fields %j", (change) => {
    expect(() => normalizeReleaseRequest({ ...release(), ...change })).toThrow();
  });
  it("SDK sourceRef resolves the real consumer module", () => {
    const sdk = JSON.parse(readFileSync("docs/contracts/helm-core-sdk.contract.json", "utf8"));
    expect(sdk.stableInterfaces.find((entry: { interfaceKey: string }) => entry.interfaceKey === "resource-reservation-contract")?.sourceRef).toBe("lib/resource-reservation/contract.ts");
  });
});

describe("complete reservation wire validation", () => {
  it("accepts JSON roundtrip with computed digest and validates frozen wire again", () => {
    const built = normalizeReserveRequest(reserve());
    expect(validateReserveRequest(JSON.parse(JSON.stringify(built)))).toEqual(built);
    expect(validateReserveRequest(built)).toEqual(built);
  });
  it("rejects tampered or missing digest and changed demand", () => {
    const built = normalizeReserveRequest(reserve());
    expect(() => validateReserveRequest({ ...built, vectorDigest: "0".repeat(64) })).toThrow("resource_digest_mismatch");
    expect(() => validateReserveRequest({ ...built, requirements: [b] })).toThrow("resource_digest_mismatch");
    expect(() => validateReserveRequest(reserve())).toThrow();
    expect(() => validateReserveRequest({ ...built, verified: true })).toThrow();
  });
});
