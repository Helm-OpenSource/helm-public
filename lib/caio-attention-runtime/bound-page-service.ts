import "server-only";

import type { PrismaClient } from "@prisma/client";

import { getRegisteredCaioAttentionPack, resolveCaioAttentionEnterpriseScope } from "@/lib/caio-attention/registry";
import type { CaioAttentionPolicy } from "@/lib/caio-attention/schedule";
import { db } from "@/lib/db";

import { createCaioAttentionLifecyclePageService } from "./page-service";

/**
 * Tenant cadence policy the bound page service runs commands with: the policy of the one attention pack the overlay
 * registers (lib/caio-attention/registry.ts). Read at every call, never captured at module load, so it does not
 * matter whether the pack registers before or after this module is first imported. Null until then: reads work
 * through the authorized loader, every command fails closed with `service_unavailable` and no operation is offered.
 */
export function getCaioAttentionBoundPagePolicy(): CaioAttentionPolicy | null {
  return getRegisteredCaioAttentionPack()?.policy ?? null;
}

/** Page service whose policy and enterprise-scope hook come from the registered pack, both read per command. */
export function createCaioAttentionPackPageService(client: PrismaClient, now?: () => Date) {
  return createCaioAttentionLifecyclePageService({
    db: client,
    now,
    getPolicy: getCaioAttentionBoundPagePolicy,
    resolveEnterpriseScope: ({ workspaceId, enterpriseSlug }) => {
      const pack = getRegisteredCaioAttentionPack();
      return pack ? resolveCaioAttentionEnterpriseScope(pack, workspaceId, enterpriseSlug) : Promise.resolve("unverified");
    },
  });
}

/** The page service the attention pages use in a running node (the web identity's client). */
export const caioAttentionBoundPageService = createCaioAttentionPackPageService(db);
