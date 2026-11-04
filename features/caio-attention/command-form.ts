import { parseCaioAttentionEvidenceRefs } from "@/lib/caio-attention/evidence";

import {
  CAIO_ATTENTION_DISPOSITION_OUTCOMES,
  type CaioAttentionCommandFailure,
  type CaioAttentionCommandInput,
} from "./service-contract";

// Server-side only: the evidence rules pull node:crypto through the member task contract.
type WithoutViewer<T> = T extends unknown ? Omit<T, "viewer"> : never;
export type CaioAttentionParsedCommand = WithoutViewer<CaioAttentionCommandInput>;
export type CaioAttentionActionState = { status: "idle" } | { status: "ok" } | { status: "error"; reason: CaioAttentionCommandFailure };
export type CaioAttentionFormFields = Readonly<Record<string, readonly string[]>>;

const ID = /^[A-Za-z0-9_-]{1,191}$/u;
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/u;
const MAX_TEXT = 2000;

/**
 * Shape check of a submitted attention form. It only rejects malformed input; who may do what, the intake
 * gate, membership and the CAS are decided again by the service inside its transaction.
 */
export function parseCaioAttentionCommandForm(fields: CaioAttentionFormFields): { ok: true; input: CaioAttentionParsedCommand } | { ok: false } {
  const one = (name: string) => fields[name]?.[0]?.trim() ?? "";
  // Multi-value fields may also arrive as one textarea with a value per line.
  const many = (name: string) => [...new Set((fields[name] ?? []).flatMap((value) => value.split(/\r?\n/u)).map((value) => value.trim()).filter(Boolean))];
  const text = (name: string) => one(name).slice(0, MAX_TEXT + 1);
  const date = (name: string) => {
    const value = one(name);
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  };
  const caseId = one("caseId");
  const version = one("expectedCommandVersion");
  const clientRequestId = one("clientRequestId");
  if (!ID.test(caseId) || !/^[0-9]{1,9}$/u.test(version) || !REQUEST_ID.test(clientRequestId)) return { ok: false };
  const base = { caseId, expectedCommandVersion: Number(version), clientRequestId };
  const op = one("op");
  if (op === "ack") return { ok: true, input: { ...base, op } };
  if (op === "note") {
    const note = text("text");
    return note && note.length <= MAX_TEXT ? { ok: true, input: { ...base, op, text: note } } : { ok: false };
  }
  if (op === "confirm") {
    const ids = [one("primaryUserId"), one("escalationUserId"), ...many("ccUserIds"), ...many("reviewerUserIds")];
    if (ids.some((id) => id && !ID.test(id))) return { ok: false };
    const command = {
      primaryUserId: one("primaryUserId") || null,
      ccUserIds: many("ccUserIds"),
      escalationUserId: one("escalationUserId") || null,
      reviewerUserIds: many("reviewerUserIds"),
      committedDueAt: date("committedDueAt"),
    };
    return { ok: true, input: { ...base, op, command } };
  }
  if (op === "submitDisposition") {
    const evidence = parseCaioAttentionEvidenceRefs(many("evidenceRefs"));
    const outcome = CAIO_ATTENTION_DISPOSITION_OUTCOMES.find((value) => value === one("outcome"));
    const disposedAt = date("disposedAt");
    const actionTaken = text("actionTaken");
    const note = text("note");
    if (!evidence.ok || !outcome || !disposedAt || !actionTaken || actionTaken.length > MAX_TEXT || note.length > MAX_TEXT) return { ok: false };
    return { ok: true, input: { ...base, op, outcome, disposedAt, actionTaken, note: note || null, evidenceRefs: evidence.refs.map((item) => item.ref) } };
  }
  if (op === "reviewAccept" || op === "reviewReturn") {
    const dispositionId = one("dispositionId");
    const reviewerVersion = one("reviewerVersion");
    const attested = parseCaioAttentionEvidenceRefs(many("attestedExternalRefs"));
    const note = text("note");
    if (!ID.test(dispositionId) || !/^[0-9]{1,9}$/u.test(reviewerVersion) || !attested.ok || !note || note.length > MAX_TEXT) return { ok: false };
    return {
      ok: true,
      input: { ...base, op, dispositionId, reviewerVersion: Number(reviewerVersion), attestedExternalRefs: attested.refs.map((item) => item.ref), note },
    };
  }
  return { ok: false };
}
