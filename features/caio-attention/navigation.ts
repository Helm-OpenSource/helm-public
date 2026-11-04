import type { CaioAttentionActor } from "@/lib/caio-attention/state-machine";

import { CAIO_ATTENTION_PAGE_SERVICE_BOUND, getCaioAttentionPageService } from "./service";
import type { CaioAttentionViewer } from "./service-contract";

/**
 * Whether the workspace shell shows the attention entry. Presentation only: the pages and the loader still
 * authorize every read. Hidden while the service is unbound or the member is inactive; OWNER and ADMIN can
 * always read cases, everyone else only once they take part in at least one current confirmed command.
 */
export function shouldShowCaioAttentionNavigation(input: Readonly<{
  bound: boolean;
  actor: Pick<CaioAttentionActor, "active" | "role">;
  participantCaseCount: number;
}>): boolean {
  if (!input.bound || !input.actor.active) return false;
  return input.actor.role === "OWNER" || input.actor.role === "ADMIN" || input.participantCaseCount > 0;
}

export async function resolveCaioAttentionNavigation(viewer: CaioAttentionViewer): Promise<boolean> {
  const base = { bound: CAIO_ATTENTION_PAGE_SERVICE_BOUND, actor: viewer.actor, participantCaseCount: 0 };
  if (!shouldShowCaioAttentionNavigation({ ...base, actor: { ...viewer.actor, role: "OWNER" } })) return false;
  if (shouldShowCaioAttentionNavigation(base)) return true;
  try {
    const mine = await getCaioAttentionPageService().listCases({ viewer, scope: "mine", page: 1, pageSize: 1 });
    return shouldShowCaioAttentionNavigation({ ...base, participantCaseCount: mine.total });
  } catch {
    return false; // a failing loader never breaks the shell; the entry just stays hidden
  }
}
