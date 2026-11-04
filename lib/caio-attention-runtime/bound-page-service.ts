import "server-only";

import type { PrismaClient } from "@prisma/client";

import { getRegisteredCaioAttentionPack, resolveCaioAttentionEnterpriseScope } from "@/lib/caio-attention/registry";
import { db } from "@/lib/db";

import { createCaioAttentionLifecyclePageService } from "./page-service";

/**
 * Page service whose policy and enterprise-scope hook come from the one attention pack the overlay registers
 * (lib/caio-attention/registry.ts), read at every command: without a registered pack every command is refused with
 * `service_unavailable` (fail closed) while reads still work through the authorized loader.
 */
export function createCaioAttentionPackPageService(client: PrismaClient, now?: () => Date) {
  return createCaioAttentionLifecyclePageService({
    db: client,
    now,
    getPolicy: () => getRegisteredCaioAttentionPack()?.policy ?? null,
    resolveEnterpriseScope: ({ workspaceId, enterpriseSlug }) => {
      const pack = getRegisteredCaioAttentionPack();
      return pack ? resolveCaioAttentionEnterpriseScope(pack, workspaceId, enterpriseSlug) : Promise.resolve("unverified");
    },
  });
}

/** The page service the attention pages use in a running node (the web identity's client). */
export const caioAttentionBoundPageService = createCaioAttentionPackPageService(db);
