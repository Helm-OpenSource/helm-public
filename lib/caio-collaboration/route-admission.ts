import { isProxy } from "node:util/types";

/** Build-time route policy, not a runtime permission or deployment authenticator. */
export type WorkBuddyRouteBinding = Readonly<{
  schemaVersion: "helm.caio.workbuddy-route-binding.v1";
  routePath: "/api/runtime/caio/workbuddy";
  mode: "legacy-configured" | "disabled";
}>;

/** Unknown shapes cannot fall back to the legacy route. No env or secret is read here. */
export function admitWorkBuddyRoute(binding: unknown): boolean {
  if (typeof binding !== "object" || binding === null || isProxy(binding) ||
      Object.getPrototypeOf(binding) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(binding);
  if (keys.length !== 3 || !keys.every(key =>
      key === "schemaVersion" || key === "routePath" || key === "mode")) return false;
  const fields = Object.getOwnPropertyDescriptors(binding);
  if (keys.some(key => typeof key !== "string" || !("value" in fields[key]))) return false;
  return fields.schemaVersion.value === "helm.caio.workbuddy-route-binding.v1" &&
    fields.routePath.value === "/api/runtime/caio/workbuddy" &&
    fields.mode.value === "legacy-configured";
}
