import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  resolveCaioGoalLedgerRoleBindings,
  selectCaioGoalLedgerForRoles,
  verifyCaioGoalLedgerRoleBindingPin,
} from "./role-binding";
import {
  SYNTHETIC_ROUTE_CONFIG_JSON,
  SYNTHETIC_ROUTE_CONFIG_VERSION,
  syntheticCaioGoalLedgerDocument,
} from "./testing/synthetic-chain";

// Hashed the way the route config publisher hashes stored bytes, independently of the ledger's own hashing.
const CONTENT_HASH = createHash("sha256").update(SYNTHETIC_ROUTE_CONFIG_JSON).digest("hex");
const row = { configJson: SYNTHETIC_ROUTE_CONFIG_JSON, contentHash: CONTENT_HASH };
const document = syntheticCaioGoalLedgerDocument();
const pin = document.roleBindingPin!;
const invalid = { ok: false, errorCode: "role_binding_pin_invalid" };
const respaced = JSON.stringify(JSON.parse(SYNTHETIC_ROUTE_CONFIG_JSON), null, 1);
const sealedAs = (configJson: string) => ({ configJson, contentHash: createHash("sha256").update(configJson).digest("hex") });

describe("verifyCaioGoalLedgerRoleBindingPin", () => {
  it("accepts the pinned version's stored bytes when every role key the document uses is bound", () => {
    expect(pin).toEqual({ source: "caio_attention_route_config", version: SYNTHETIC_ROUTE_CONFIG_VERSION, contentHash: CONTENT_HASH });
    expect(verifyCaioGoalLedgerRoleBindingPin(document, row)).toEqual({ ok: true });
  });

  it("accepts a document without role keys, which has no pin", () => {
    expect(verifyCaioGoalLedgerRoleBindingPin({ ...document, components: [], gates: [], roleBindingPin: null }, null))
      .toEqual({ ok: true });
  });

  it.each<[string, Parameters<typeof verifyCaioGoalLedgerRoleBindingPin>[0], Parameters<typeof verifyCaioGoalLedgerRoleBindingPin>[1]]>([
    ["a pinned version that does not exist", document, null],
    ["the same config re-serialized", document, { configJson: respaced, contentHash: CONTENT_HASH }],
    ["a row whose own content hash disagrees", document, { ...row, contentHash: "c".repeat(64) }],
    ["a pin naming another content hash", { ...document, roleBindingPin: { ...pin, contentHash: "c".repeat(64) } }, row],
    ["sealed bytes that are not JSON", { ...document, roleBindingPin: { ...pin, contentHash: sealedAs("{").contentHash } },
      sealedAs("{")],
    ["a role key the config does not bind", { ...document, gates: [{ ...document.gates[0], holderRoleKey: "audit_holder" }] }, row],
    ["a role key that only Object provides", { ...document, gates: [{ ...document.gates[0], holderRoleKey: "constructor" }] }, row],
  ])("refuses %s", (_name, candidate, pinnedConfig) => {
    expect(verifyCaioGoalLedgerRoleBindingPin(candidate, pinnedConfig)).toEqual(invalid);
  });
});

describe("resolveCaioGoalLedgerRoleBindings", () => {
  it("resolves people only while the pinned version is active", () => {
    expect(resolveCaioGoalLedgerRoleBindings(pin, { activeVersion: SYNTHETIC_ROUTE_CONFIG_VERSION, activeConfig: row })).toEqual({
      state: "match",
      routeConfigVersion: SYNTHETIC_ROUTE_CONFIG_VERSION,
      roleBindings: { line_a_owner: ["u_line_a"], line_b_owner: ["u_line_b"], release_holder: ["u_release"] },
    });
  });

  it.each([[SYNTHETIC_ROUTE_CONFIG_VERSION + 1], [null]])("reports drift when the active version is %j", (activeVersion) => {
    expect(resolveCaioGoalLedgerRoleBindings(pin, { activeVersion, activeConfig: row }))
      .toEqual({ state: "drift", pinnedVersion: SYNTHETIC_ROUTE_CONFIG_VERSION, activeVersion });
  });

  it.each([
    ["missing", null],
    ["re-serialized", { configJson: respaced, contentHash: CONTENT_HASH }],
    ["resealed with other bytes", sealedAs(respaced)],
  ])("never matches when the pinned version is active but its row is %s", (_name, activeConfig) => {
    expect(resolveCaioGoalLedgerRoleBindings(pin, { activeVersion: SYNTHETIC_ROUTE_CONFIG_VERSION, activeConfig }))
      .toEqual({ state: "route_config_missing" });
  });
});

describe("selectCaioGoalLedgerForRoles", () => {
  it("keeps the components and gates of the given roles, by key and label only", () => {
    expect(selectCaioGoalLedgerForRoles(document, ["line_a_owner", "release_holder"])).toEqual({
      components: [{ key: "line_a", label: "示例工作线 A" }],
      gates: [{ key: "gate.release", label: "发布关卡" }],
    });
    expect(selectCaioGoalLedgerForRoles(document, ["line_b_owner"])).toEqual({
      components: [{ key: "line_b", label: "Synthetic line B" }], gates: [],
    });
    expect(selectCaioGoalLedgerForRoles(document, ["unbound_role"])).toEqual({ components: [], gates: [] });
  });
});
