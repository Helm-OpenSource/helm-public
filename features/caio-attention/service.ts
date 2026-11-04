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

export const CAIO_ATTENTION_PAGE_SERVICE_BOUND = boundService !== null;

/**
 * Close capability follows the binding: 1 only when the real lifecycle service serves these pages. The release
 * file lib/caio-attention/capability.json (read by the heartbeat and the deploy check) must carry the same value;
 * check:caio-attention asserts equality, so binding the service and raising the file land in one change.
 */
export const CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION = CAIO_ATTENTION_PAGE_SERVICE_BOUND ? 1 : 0;

export function getCaioAttentionPageService(): CaioAttentionPageService {
  return boundService ?? CAIO_ATTENTION_UNAVAILABLE_SERVICE;
}
