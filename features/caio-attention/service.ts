import { caioAttentionBoundPageService } from "@/lib/caio-attention-runtime/bound-page-service";

import type { CaioAttentionPageService } from "./service-contract";

/**
 * Binding point for the attention pages. Without a bound lifecycle service and its authorized loader,
 * this fail-closed stub serves every page: lists are empty, every case is `not_found` and every command is
 * refused with `service_unavailable`. It reads nothing and writes nothing. Wiring the real service replaces
 * `boundService` and flips `CAIO_ATTENTION_PAGE_SERVICE_BOUND`.
 */
export const CAIO_ATTENTION_UNAVAILABLE_SERVICE: CaioAttentionPageService = {
  async listCases(input) {
    return { items: [], page: input.page, pageSize: input.pageSize, total: 0 };
  },
  async loadCase() {
    return { ok: false, reason: "not_found" };
  },
  async runCommand() {
    return { ok: false, reason: "service_unavailable" };
  },
};

// Bound to the lifecycle service and its authorized loader (lib/caio-attention-runtime/page-service.ts).
const boundService: CaioAttentionPageService | null = caioAttentionBoundPageService;

/**
 * Build-time binding: these pages are served by the real lifecycle service (not the fail-closed stub). Whether a
 * node can actually close cases is decided at call time, not here: it also needs the overlay's pack policy, which
 * may register after this module loads. That runtime rule lives in lib/caio-attention-runtime/close-chain-binding.ts
 * (pageServiceBound = BOUND && getCaioAttentionBoundPagePolicy() != null) and drives the probe and the heartbeat.
 */
export const CAIO_ATTENTION_PAGE_SERVICE_BOUND = boundService !== null;

/**
 * Release close capability follows the build-time binding: 1 only when the real lifecycle service serves these
 * pages. lib/caio-attention/capability.json must carry the same value (check:caio-attention asserts equality); what
 * a node reports is that value only while the runtime rule holds, otherwise 0.
 */
export const CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION = CAIO_ATTENTION_PAGE_SERVICE_BOUND ? 1 : 0;

export function getCaioAttentionPageService(): CaioAttentionPageService {
  return boundService ?? CAIO_ATTENTION_UNAVAILABLE_SERVICE;
}
