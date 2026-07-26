// CAIO Pro V1 completion gate -> IA work-entry attention source.
//
// The post-initialization P4-P8 TODO list surfaces in the SAME governed
// work-entry channel as every other role-routed item (attention feed ->
// role-anomaly projection -> "需要你处理"), not in a separate panel.
//
// Role split (owner directive): a bound FDE executes install, per-source
// onboarding, receipt follow-through, validation and device acceptance;
// the CEO alone holds the decision seats (G0 acceptance, question
// selection, maturity decision, completion acceptance). The OWNER scope
// always sees the FULL list (accountability); an "fde" workstation sees
// only the operational subset; every other role sees nothing.
//
// Items are read-only pointers: fixed de-identified labels, an in-site
// href, and the assessment content hash as basisRef. Navigation never
// authorizes; the target surface re-authenticates.

import type { AttentionItem } from "@/lib/shell/attention-feed";
import {
  CAIO_PRO_V1_COMPLETION_ITEMS,
  type CaioProV1CompletionItemKey,
} from "@/lib/stage1-owner-loop/caio-pro-completion";

export const CAIO_PRO_V1_COMPLETION_ATTENTION_HREF =
  "/dashboard#caio-pro-v1-completion";

// CEO-only decision seats; everything else is FDE-operational.
export const CAIO_PRO_V1_DECISION_ITEM_KEYS = [
  "p5_g0_accepted",
  "p6_ceo_selection_recorded",
  "p8_maturity_decision_recorded",
] as const satisfies readonly CaioProV1CompletionItemKey[];

const DECISION_ITEM_KEY_SET: ReadonlySet<string> = new Set(
  CAIO_PRO_V1_DECISION_ITEM_KEYS,
);

// Fixed, de-identified labels — never dynamic content, so no PII can ride
// the label into the shared attention channel.
const ITEM_LABELS: Readonly<Record<CaioProV1CompletionItemKey, string>> = {
  p4_asset_inventory_confirmed:
    "CAIO Pro completion: customer asset-inventory confirmation missing",
  p4_asset_states_complete:
    "CAIO Pro completion: per-asset stage states incomplete",
  p5_g0_accepted: "CAIO Pro completion: G0 acceptance missing (CEO decision)",
  p6_portfolio_generated:
    "CAIO Pro completion: operating-question portfolio missing",
  p6_ceo_selection_recorded:
    "CAIO Pro completion: CEO question selection missing (CEO decision)",
  p6_implementation_plans_materialized:
    "CAIO Pro completion: implementation plans missing",
  p7_supervision_chain_closed:
    "CAIO Pro completion: no closed supervision chain yet",
  p7_value_receipts_recorded:
    "CAIO Pro completion: 30-day value receipts missing",
  p3_device_security_accepted:
    "CAIO Pro completion: device security acceptance missing",
  p3_runtime_truth_bound:
    "CAIO Pro completion: runtime truth binding missing",
  p8_incident_posture_clear:
    "CAIO Pro completion: incident posture attestation missing",
  p8_retrospective_recorded:
    "CAIO Pro completion: retrospective receipt missing",
  p8_maturity_decision_recorded:
    "CAIO Pro completion: maturity decision missing (CEO decision)",
};

export type CaioProV1CompletionAttentionInput = {
  missingItemKeys: readonly CaioProV1CompletionItemKey[];
  /** Content hash of the live completion assessment (basisRef only). */
  assessmentContentHash: string;
  /** The viewer's resolved role attention category. */
  viewerRoleCategory: string;
  /** True for OWNER/ADMIN scope: sees the full accountable list. */
  viewerHasOwnerScope: boolean;
};

export function buildCaioProV1CompletionAttention(
  input: CaioProV1CompletionAttentionInput,
): AttentionItem[] {
  const known = new Set<string>(CAIO_PRO_V1_COMPLETION_ITEMS);
  const missing = input.missingItemKeys.filter((key) => known.has(key));
  const audience: readonly CaioProV1CompletionItemKey[] =
    input.viewerHasOwnerScope
      ? missing
      : input.viewerRoleCategory === "fde"
        ? missing.filter((key) => !DECISION_ITEM_KEY_SET.has(key))
        : [];
  return audience.map((itemKey) => ({
    key: `caio-pro-v1-completion:${itemKey}`,
    severity: "critical" as const,
    label: ITEM_LABELS[itemKey],
    roleCategory: input.viewerRoleCategory,
    href: CAIO_PRO_V1_COMPLETION_ATTENTION_HREF,
    basisRef: input.assessmentContentHash,
  }));
}
