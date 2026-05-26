import { describe, expect, it } from "vitest";

import {
  buildFounderLoopSourceId,
  isFounderLoopSourceId,
  parseFounderLoopSourceId,
  type BuildFounderLoopSourceIdInput,
} from "./source-id";

const VALID_PARTS: BuildFounderLoopSourceIdInput = {
  scope: "helm_self",
  workspaceSlug: "helm_reserved_primary",
  runId: "fol-helm-self-2026-05-21-run01",
  signalId: "sig-self-prodstab-01",
};

describe("parseFounderLoopSourceId", () => {
  it("parses a canonical helm_self sourceId", () => {
    const raw =
      "founder_loop:helm_self:helm_reserved_primary:fol-helm-self-2026-05-21-run01:sig-self-prodstab-01";
    expect(parseFounderLoopSourceId(raw)).toEqual({
      scope: "helm_self",
      workspaceSlug: "helm_reserved_primary",
      runId: "fol-helm-self-2026-05-21-run01",
      signalId: "sig-self-prodstab-01",
      reissue: null,
    });
  });

  it("parses a customer_vertical sourceId with :reissue suffix", () => {
    const raw =
      "founder_loop:customer_vertical:case_mgmt_alias:fol-customer-vertical-2026-05-21-run01:sig-cust-asset-01:reissue:3";
    expect(parseFounderLoopSourceId(raw)).toEqual({
      scope: "customer_vertical",
      workspaceSlug: "case_mgmt_alias",
      runId: "fol-customer-vertical-2026-05-21-run01",
      signalId: "sig-cust-asset-01",
      reissue: 3,
    });
  });

  it("rejects non-string input", () => {
    expect(parseFounderLoopSourceId(null)).toBeNull();
    expect(parseFounderLoopSourceId(undefined)).toBeNull();
    expect(parseFounderLoopSourceId(42)).toBeNull();
    expect(parseFounderLoopSourceId({})).toBeNull();
  });

  it("rejects strings missing the founder_loop prefix", () => {
    expect(
      parseFounderLoopSourceId("helm_self:helm_reserved_primary:run:sig"),
    ).toBeNull();
  });

  it("rejects unknown scope", () => {
    expect(
      parseFounderLoopSourceId(
        "founder_loop:third_party:helm_reserved_primary:run:sig",
      ),
    ).toBeNull();
  });

  it("rejects workspaceSlug with uppercase, leading digit, or too short", () => {
    expect(
      parseFounderLoopSourceId("founder_loop:helm_self:Helm:run:sig"),
    ).toBeNull();
    expect(
      parseFounderLoopSourceId("founder_loop:helm_self:1helm:run:sig"),
    ).toBeNull();
    expect(
      parseFounderLoopSourceId("founder_loop:helm_self:he:run:sig"),
    ).toBeNull();
  });

  it("rejects signalId containing forbidden chars", () => {
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run01:sig with space",
      ),
    ).toBeNull();
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run01:sig.dot",
      ),
    ).toBeNull();
  });

  it("rejects reissue suffix outside 1–99", () => {
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run:sig:reissue:0",
      ),
    ).toBeNull();
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run:sig:reissue:100",
      ),
    ).toBeNull();
  });

  it("accepts reissue boundary values 1 and 99", () => {
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run:sig:reissue:1",
      )?.reissue,
    ).toBe(1);
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run:sig:reissue:99",
      )?.reissue,
    ).toBe(99);
  });

  it("rejects trailing garbage after a well-formed prefix", () => {
    expect(
      parseFounderLoopSourceId(
        "founder_loop:helm_self:helm_reserved_primary:run01:sig01:not_reissue",
      ),
    ).toBeNull();
  });
});

describe("buildFounderLoopSourceId", () => {
  it("round-trips with parseFounderLoopSourceId for a valid input", () => {
    const raw = buildFounderLoopSourceId(VALID_PARTS);
    expect(parseFounderLoopSourceId(raw)).toEqual({
      ...VALID_PARTS,
      reissue: null,
    });
  });

  it("appends :reissue:N when provided", () => {
    const raw = buildFounderLoopSourceId({ ...VALID_PARTS, reissue: 2 });
    expect(raw.endsWith(":reissue:2")).toBe(true);
  });

  it("treats null and missing reissue identically", () => {
    expect(
      buildFounderLoopSourceId({ ...VALID_PARTS, reissue: null }),
    ).toBe(buildFounderLoopSourceId(VALID_PARTS));
  });

  it("throws on invalid scope", () => {
    expect(() =>
      buildFounderLoopSourceId({
        ...VALID_PARTS,
        scope: "not_a_scope" as unknown as "helm_self",
      }),
    ).toThrowError(/invalid scope/);
  });

  it("throws on invalid workspaceSlug", () => {
    expect(() =>
      buildFounderLoopSourceId({ ...VALID_PARTS, workspaceSlug: "BadCase" }),
    ).toThrowError(/invalid workspaceSlug/);
  });

  it("throws on invalid reissue number", () => {
    expect(() =>
      buildFounderLoopSourceId({ ...VALID_PARTS, reissue: 0 }),
    ).toThrowError(/invalid reissue/);
    expect(() =>
      buildFounderLoopSourceId({ ...VALID_PARTS, reissue: 100 }),
    ).toThrowError(/invalid reissue/);
    expect(() =>
      buildFounderLoopSourceId({ ...VALID_PARTS, reissue: 1.5 }),
    ).toThrowError(/invalid reissue/);
  });
});

describe("isFounderLoopSourceId", () => {
  it("narrows a known-valid string", () => {
    const raw = buildFounderLoopSourceId(VALID_PARTS);
    expect(isFounderLoopSourceId(raw)).toBe(true);
  });

  it("returns false on malformed input", () => {
    expect(isFounderLoopSourceId("nope")).toBe(false);
    expect(isFounderLoopSourceId(undefined)).toBe(false);
  });
});
