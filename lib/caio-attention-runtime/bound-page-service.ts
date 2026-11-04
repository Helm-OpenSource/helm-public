import "server-only";

import { db } from "@/lib/db";
import type { CaioAttentionPolicy } from "@/lib/caio-attention/schedule";

import { createCaioAttentionLifecyclePageService } from "./page-service";

/**
 * Tenant cadence policy the bound page service runs commands with. The overlay registers it through the attention
 * pack registry of the generator slice; this chain does not carry that registry, so it answers null: reads work
 * through the authorized loader, every command fails closed with `service_unavailable`, no operation is offered and
 * the page binding reports not closable (features/caio-attention/service.ts derives the flag from this).
 * Integration hard precondition: wire it to `getRegisteredCaioAttentionPack()?.policy ?? null`, pass the pack's
 * enterprise-scope hook as `resolveEnterpriseScope`, and register the pack before this module is first loaded.
 */
export function getCaioAttentionBoundPagePolicy(): CaioAttentionPolicy | null {
  return null;
}

export const caioAttentionBoundPageService = createCaioAttentionLifecyclePageService({ db, getPolicy: getCaioAttentionBoundPagePolicy });
