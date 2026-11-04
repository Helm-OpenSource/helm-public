import "server-only";

import { CAIO_ATTENTION_PAGE_SERVICE_BOUND } from "@/features/caio-attention/service";
import { getRegisteredCaioAttentionPack } from "@/lib/caio-attention/registry";

import { CAIO_ATTENTION_PAGE_OPERATIONS } from "./page-service";

/** Operations the close chain needs from the bound page service (design v5 §1.4: submit, review, reissue, reviewers). */
export const CAIO_ATTENTION_CLOSE_CHAIN_OPERATIONS = ["submitDisposition", "reviewAccept", "reviewReturn", "reissue", "assignReviewers"] as const;

/**
 * Whether the close chain is wired into this node, read on every probe (never a release constant):
 *   pageServiceBound — the pages use the real lifecycle service (CAIO_ATTENTION_PAGE_SERVICE_BOUND) AND the overlay
 *                      registered the attention pack, so commands have a policy (getPolicy() != null).
 *   lifecycleRoutes  — the bound service routes every close-chain operation.
 * Until both hold no node can attest, so resume stays blocked.
 */
export const CAIO_ATTENTION_CLOSE_CHAIN_BINDING: Readonly<{ pageServiceBound: boolean; lifecycleRoutes: boolean }> = {
  get pageServiceBound() {
    return CAIO_ATTENTION_PAGE_SERVICE_BOUND && getRegisteredCaioAttentionPack()?.policy != null;
  },
  get lifecycleRoutes() {
    return CAIO_ATTENTION_PAGE_SERVICE_BOUND
      && CAIO_ATTENTION_CLOSE_CHAIN_OPERATIONS.every((op) => (CAIO_ATTENTION_PAGE_OPERATIONS as readonly string[]).includes(op));
  },
};
