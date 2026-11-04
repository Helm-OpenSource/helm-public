import { caioAttentionBoundPageService } from "@/lib/caio-attention-runtime/bound-page-service";

import type { CaioAttentionPageService } from "./service-contract";

/**
 * Binding point for the attention pages. Without a bound lifecycle service and its authorized loader,
 * this fail-closed stub serves every page: lists are empty, every case is `not_found` and every command is
 * refused with `service_unavailable`. It reads nothing and writes nothing. Wiring the real service replaces
 * `boundService` and flips `CAIO_ATTENTION_PAGE_SERVICE_BOUND`, which the capability probe must require before
 * a node may report close capability.
 */
const unavailableService: CaioAttentionPageService = {
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

export function getCaioAttentionPageService(): CaioAttentionPageService {
  return boundService ?? unavailableService;
}
