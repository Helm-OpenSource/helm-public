import { EVIDENCE_REF_PATTERN } from "@/lib/member-mcp/task-contract";

/**
 * Disposition evidence: refs are opaque `<kind>:<id>` (same format as member task reports), never URLs
 * or free text. Lookups happen in the service; these rules judge what was found. System evidence only
 * shows that something happened, not that it caused the fix, so the reviewer's note is always required.
 */

export const CAIO_ATTENTION_MAX_EVIDENCE_REFS = 10;
const AUDIT_LOG_GRACE_MS = 24 * 60 * 60_000;

export type CaioAttentionEvidenceRole = "primary" | "auxiliary" | "external";
const SYSTEM_KIND_ROLES: Readonly<Record<string, CaioAttentionEvidenceRole>> = {
  "audit-log": "primary",
  "execution-receipt": "primary",
  "caio-tick": "auxiliary",
  "caio-detector-evaluation": "auxiliary",
  "caio-anomaly-candidate": "auxiliary",
};

export function parseCaioAttentionEvidenceRefs(refs: readonly unknown[]):
  | { ok: true; refs: { ref: string; kind: string; role: CaioAttentionEvidenceRole }[] }
  | { ok: false; errorCode: "evidence_ref_invalid" | "evidence_ref_duplicate" | "evidence_ref_too_many" } {
  if (refs.length > CAIO_ATTENTION_MAX_EVIDENCE_REFS) return { ok: false, errorCode: "evidence_ref_too_many" };
  if (new Set(refs).size !== refs.length) return { ok: false, errorCode: "evidence_ref_duplicate" };
  const parsed = [];
  for (const ref of refs) {
    if (typeof ref !== "string" || !EVIDENCE_REF_PATTERN.test(ref) || /^https?:/iu.test(ref)) {
      return { ok: false, errorCode: "evidence_ref_invalid" };
    }
    const kind = ref.slice(0, ref.indexOf(":"));
    parsed.push({ ref, kind, role: SYSTEM_KIND_ROLES[kind] ?? "external" });
  }
  return { ok: true, refs: parsed };
}

/** What the service found for one system ref. Absent fields mean "not applicable to this kind". */
export type CaioAttentionResolvedEvidence = Readonly<{
  ref: string;
  found: boolean;
  workspaceId?: string;
  createdAt?: Date;
  bucketStart?: Date;
  tickStatus?: string;
  detectorId?: string;
  outcome?: string;
}>;

export type CaioAttentionEvidenceContext = Readonly<{
  workspaceId: string;
  detectorId: string;
  dispatchedAt: Date;
  disposedAt: Date;
}>;

function systemEvidenceValid(kind: string, item: CaioAttentionResolvedEvidence, ctx: CaioAttentionEvidenceContext): boolean {
  if (!item.found || item.workspaceId !== ctx.workspaceId) return false;
  const at = (value: Date | undefined) => value?.getTime() ?? Number.NaN;
  switch (kind) {
    case "caio-tick": // a completed judgement after dispatch; never sufficient on its own
      return item.tickStatus === "COMPLETED" && at(item.bucketStart) >= ctx.dispatchedAt.getTime();
    case "caio-detector-evaluation": // the same detector evaluated and did not hit after disposal
      return item.detectorId === ctx.detectorId && item.outcome === "NO_HIT" && at(item.bucketStart) >= ctx.disposedAt.getTime();
    case "audit-log":
      return at(item.createdAt) >= ctx.dispatchedAt.getTime() && at(item.createdAt) <= ctx.disposedAt.getTime() + AUDIT_LOG_GRACE_MS;
    case "execution-receipt":
      return at(item.createdAt) >= ctx.dispatchedAt.getTime();
    default: // caio-anomaly-candidate
      return true;
  }
}

/**
 * Review gate: every system ref must be valid; at least one valid primary system ref or one external
 * ref the reviewer ticked as checked; and a non-empty review note.
 */
export function evaluateCaioAttentionReviewEvidence(input: Readonly<{
  evidenceRefs: readonly string[];
  resolved: readonly CaioAttentionResolvedEvidence[];
  attestedExternalRefs: readonly string[];
  reviewNote: string;
  context: CaioAttentionEvidenceContext;
}>): { ok: true } | { ok: false; reasons: string[] } {
  const parsed = parseCaioAttentionEvidenceRefs(input.evidenceRefs);
  if (!parsed.ok) return { ok: false, reasons: [parsed.errorCode] };
  const reasons = new Set<string>();
  const { dispatchedAt, disposedAt } = input.context;
  if (disposedAt.getTime() < dispatchedAt.getTime()) reasons.add("disposed_before_dispatch");
  let sufficient = false;
  for (const { ref, kind, role } of parsed.refs) {
    if (role === "external") {
      if (input.attestedExternalRefs.includes(ref)) sufficient = true;
      continue;
    }
    const item = input.resolved.find((candidate) => candidate.ref === ref);
    if (!item || !systemEvidenceValid(kind, item, input.context)) reasons.add(`evidence_invalid:${ref}`);
    else if (role === "primary") sufficient = true;
  }
  const externalRefs = parsed.refs.filter((item) => item.role === "external").map((item) => item.ref);
  if (input.attestedExternalRefs.some((ref) => !externalRefs.includes(ref))) reasons.add("attested_ref_not_submitted");
  if (!sufficient) reasons.add("evidence_insufficient");
  if (!input.reviewNote.trim()) reasons.add("review_note_required");
  return reasons.size === 0 ? { ok: true } : { ok: false, reasons: [...reasons].sort() };
}
