import { type CaioAttentionRoleBindings, type CaioAttentionRouteConfig, parseCaioAttentionRouteConfig } from "@/lib/caio-attention/contracts";

import { sha256HexOfCaioGoalLedgerText } from "./canonical-json";
import { type CaioGoalLedgerDocument, collectCaioGoalLedgerRoleKeys } from "./contracts";

/**
 * Role bindings for the CAIO goal ledger: pure, no IO. People stay in the attention route config; a ledger
 * document pins the version and content hash it was written for. The pin holds only when the stored config bytes
 * hash to it, so a re-serialized or edited config never matches, whatever its row says about itself.
 */

type Pin = NonNullable<CaioGoalLedgerDocument["roleBindingPin"]>;

/** One stored attention route config version: its bytes as published and the content hash recorded with them. */
export type CaioGoalLedgerRouteConfigRow = Readonly<{ configJson: string; contentHash: string }>;

function openPinnedConfig(pin: Pin, row: CaioGoalLedgerRouteConfigRow | null): CaioAttentionRouteConfig | null {
  if (row === null) return null;
  const digest = sha256HexOfCaioGoalLedgerText(row.configJson);
  if (!digest.ok || digest.hash !== pin.contentHash || row.contentHash !== pin.contentHash) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(row.configJson);
  } catch {
    return null;
  }
  const parsed = parseCaioAttentionRouteConfig(raw);
  return parsed.ok ? parsed.config : null;
}

/**
 * Write-time check for the document about to become the head, given the stored row of the pinned version (null
 * when that version does not exist). The version need not be active. A document without role keys has no pin.
 */
export function verifyCaioGoalLedgerRoleBindingPin(
  document: CaioGoalLedgerDocument,
  pinnedConfig: CaioGoalLedgerRouteConfigRow | null,
): { ok: true } | { ok: false; errorCode: "role_binding_pin_invalid" } {
  if (document.roleBindingPin === null) return { ok: true };
  const config = openPinnedConfig(document.roleBindingPin, pinnedConfig);
  const bound = config !== null
    && collectCaioGoalLedgerRoleKeys(document).every((roleKey) => Object.hasOwn(config.roleBindings, roleKey));
  return bound ? { ok: true } : { ok: false, errorCode: "role_binding_pin_invalid" };
}

export type CaioGoalLedgerRoleBindingResolution =
  | { state: "match"; routeConfigVersion: number; roleBindings: CaioAttentionRoleBindings }
  | { state: "drift"; pinnedVersion: number; activeVersion: number | null }
  | { state: "route_config_missing" };

/**
 * Read-time resolution of people. `activeVersion` is the route config head (null without one) and `activeConfig`
 * its stored row (null when missing). Another active version is drift. The pinned version being active while its
 * row is missing, or no longer hashes to the pin, is `route_config_missing`, never a match.
 */
export function resolveCaioGoalLedgerRoleBindings(
  pin: Pin,
  active: Readonly<{ activeVersion: number | null; activeConfig: CaioGoalLedgerRouteConfigRow | null }>,
): CaioGoalLedgerRoleBindingResolution {
  if (active.activeVersion !== pin.version) {
    return { state: "drift", pinnedVersion: pin.version, activeVersion: active.activeVersion };
  }
  const config = openPinnedConfig(pin, active.activeConfig);
  if (config === null) return { state: "route_config_missing" };
  return { state: "match", routeConfigVersion: pin.version, roleBindings: config.roleBindings };
}

/** The components and gates whose role is among `roleKeys`, by key and label only. */
export function selectCaioGoalLedgerForRoles(document: CaioGoalLedgerDocument, roleKeys: readonly string[]): {
  components: Array<{ key: string; label: string }>;
  gates: Array<{ key: string; label: string }>;
} {
  const held = new Set(roleKeys);
  return {
    components: document.components.filter((item) => held.has(item.primaryRoleKey)).map(({ key, label }) => ({ key, label })),
    gates: document.gates.filter((item) => held.has(item.holderRoleKey)).map(({ key, label }) => ({ key, label })),
  };
}
