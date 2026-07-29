// CAIO context broker — no_cross_project_context resolution with inheritance.
//
// A workspace-scoped opt-out blocks every cross-project context flow in the
// workspace. A project-scoped opt-out isolates that project in BOTH
// directions: it neither contributes context to other projects nor receives
// context contributed by other projects.

import {
  ruleHitRef,
  type CaioNegativeRule,
} from "@/lib/caio-context-broker/broker-contracts";

export type CrossProjectPolicyResolution = Readonly<{
  /** True when context may flow from sourceProject to targetProject. */
  allowed: boolean;
  /** Version-pinned refs of the published rules that blocked the flow. */
  blockedByRuleRefs: readonly string[];
}>;

export function resolveCrossProjectPolicy(input: {
  rules: readonly CaioNegativeRule[];
  workspaceId: string;
  sourceProject: string;
  targetProject: string;
}): CrossProjectPolicyResolution {
  if (input.sourceProject === input.targetProject) {
    return Object.freeze({ allowed: true, blockedByRuleRefs: [] });
  }
  const blocking = input.rules.filter((rule) => {
    if (
      rule.workspaceId !== input.workspaceId ||
      rule.status !== "published" ||
      rule.ruleKind !== "no_cross_project_context"
    ) {
      return false;
    }
    if (rule.scopeKind === "workspace") return true;
    // Project scope: the opted-out project can neither contribute nor receive.
    return (
      rule.scopeRef === input.sourceProject ||
      rule.scopeRef === input.targetProject
    );
  });
  return Object.freeze({
    allowed: blocking.length === 0,
    blockedByRuleRefs: Object.freeze(blocking.map(ruleHitRef)),
  });
}
