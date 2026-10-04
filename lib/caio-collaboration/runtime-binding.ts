import type { WorkBuddyRouteBinding } from "./route-admission";

/**
 * Fixed source slot for an independently reviewed assembler. This default
 * preserves the legacy configured route; environment values never select it.
 * A disabled deployment must install and verify its own disabled slot through
 * its source/package assembly contract. This module grants no activation.
 */
export const WORKBUDDY_RUNTIME_BINDING: WorkBuddyRouteBinding = Object.freeze({
  schemaVersion: "helm.caio.workbuddy-route-binding.v1",
  routePath: "/api/runtime/caio/workbuddy",
  mode: "legacy-configured",
});
