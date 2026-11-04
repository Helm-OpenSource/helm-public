import "server-only";

import { db } from "@/lib/db";

import { createCaioAttentionLifecyclePageService } from "./page-service";

/**
 * The page service the attention pages use in a running node. Commands need the tenant cadence policy, which the
 * overlay registers through the attention pack registry of the generator slice; this chain does not carry that
 * registry yet, so `getPolicy` answers null and every command fails closed with `service_unavailable` while reads
 * work through the authorized loader. Integration wires it to `getRegisteredCaioAttentionPack()?.policy` and the
 * pack's enterprise-scope hook.
 */
export const caioAttentionBoundPageService = createCaioAttentionLifecyclePageService({ db, getPolicy: () => null });
