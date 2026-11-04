"use client";

import { useActionState, useRef, useState } from "react";

import { runCaioAttentionCommandAction } from "./actions";
import type { CaioAttentionActionState } from "./command-form";
import { caioAttentionCopy, caioAttentionFailureLabel, caioAttentionFieldLabel, caioAttentionOutcomeLabel } from "./copy";
import { CAIO_ATTENTION_DISPOSITION_OUTCOMES } from "./service-contract";
import { diffCaioAttentionCommand } from "./view-model";

export type CaioAttentionFormCommon = Readonly<{ caseId: string; commandVersion: number; english: boolean }>;
type Member = Readonly<{ id: string; label: string }>;
type PrefillProps = Readonly<{
  primaryUserId: string | null;
  ccUserIds: readonly string[];
  escalationUserId: string | null;
  reviewerUserIds: readonly string[];
  committedDueAt: string | null;
}>;

const IDLE: CaioAttentionActionState = { status: "idle" };
const field = "w-full border border-[color:var(--border)] bg-transparent px-2 py-1 text-sm";
const pad = (value: number) => String(value).padStart(2, "0");
// datetime-local works in the browser's zone; the hidden field carries the absolute instant.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local: string) => (local && !Number.isNaN(new Date(local).getTime()) ? new Date(local).toISOString() : "");
const toggle = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

/**
 * Each form instance owns its request id, created in the browser before its first submission and kept across
 * retries of a failed one (so the service can treat a retry as the same request), then replaced after a success.
 */
export function useCaioAttentionCommandAction() {
  const requestId = useRef<string | null>(null);
  return useActionState(async (previous: CaioAttentionActionState, formData: FormData) => {
    requestId.current ??= crypto.randomUUID();
    formData.set("clientRequestId", requestId.current);
    const next = await runCaioAttentionCommandAction(previous, formData);
    if (next.status === "ok") requestId.current = null;
    return next;
  }, IDLE);
}

function Identity({ common, op }: { common: CaioAttentionFormCommon; op?: string }) {
  return (
    <>
      <input type="hidden" name="caseId" value={common.caseId} />
      <input type="hidden" name="expectedCommandVersion" value={common.commandVersion} />
      {op ? <input type="hidden" name="op" value={op} /> : null}
    </>
  );
}

function Outcome({ state, english }: { state: CaioAttentionActionState; english: boolean }) {
  if (state.status === "idle") return null;
  const message = state.status === "ok" ? caioAttentionCopy(english).saved : caioAttentionFailureLabel(english, state.reason);
  return <p role="status" className="text-sm" data-action-status={state.status}>{message}</p>;
}

export function CaioAttentionConfirmForm({ common, prefill, members }: { common: CaioAttentionFormCommon; prefill: PrefillProps; members: readonly Member[] }) {
  const copy = caioAttentionCopy(common.english);
  const [state, action, pending] = useCaioAttentionCommandAction();
  const [primary, setPrimary] = useState(prefill.primaryUserId ?? "");
  const [cc, setCc] = useState<readonly string[]>(prefill.ccUserIds);
  const [escalation, setEscalation] = useState(prefill.escalationUserId ?? "");
  const [reviewers, setReviewers] = useState<readonly string[]>(prefill.reviewerUserIds);
  const [dueLocal, setDueLocal] = useState(() => toLocalInput(prefill.committedDueAt));
  const joiner = common.english ? ", " : "、";
  const label = (id: string) => members.find((member) => member.id === id)?.label ?? id;
  const changes = diffCaioAttentionCommand(
    { ...prefill, committedDueAt: prefill.committedDueAt ? new Date(prefill.committedDueAt) : null },
    { primaryUserId: primary || null, ccUserIds: cc, escalationUserId: escalation || null, reviewerUserIds: reviewers, committedDueAt: toIso(dueLocal) ? new Date(toIso(dueLocal)) : null },
  );
  const select = (name: string, value: string, onChange: (value: string) => void) => (
    <select name={name} value={value} onChange={(event) => onChange(event.target.value)} className={field}>
      <option value="">{copy.none}</option>
      {members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
    </select>
  );
  const checks = (name: string, list: readonly string[], set: (next: readonly string[]) => void) => (
    <div className="flex flex-wrap gap-3">
      {members.map((member) => (
        <label key={member.id} className="flex items-center gap-1 text-sm">
          <input type="checkbox" name={name} value={member.id} checked={list.includes(member.id)} onChange={() => set(toggle(list, member.id))} />
          {member.label}
        </label>
      ))}
    </div>
  );
  return (
    <form action={action} className="space-y-3 border border-[color:var(--border)] px-4 py-3" data-testid="caio-attention-confirm-form">
      <h3 className="font-medium">{copy.confirmTitle}</h3>
      <p className="text-xs text-[color:var(--text-muted)]">{copy.confirmHint}</p>
      <Identity common={common} op="confirm" />
      <label className="block text-sm">{caioAttentionFieldLabel(common.english, "primaryUserId")}{select("primaryUserId", primary, setPrimary)}</label>
      <fieldset className="text-sm"><legend>{caioAttentionFieldLabel(common.english, "ccUserIds")}</legend>{checks("ccUserIds", cc, setCc)}</fieldset>
      <label className="block text-sm">{caioAttentionFieldLabel(common.english, "escalationUserId")}{select("escalationUserId", escalation, setEscalation)}</label>
      <fieldset className="text-sm"><legend>{caioAttentionFieldLabel(common.english, "reviewerUserIds")}</legend>{checks("reviewerUserIds", reviewers, setReviewers)}</fieldset>
      <label className="block text-sm">
        {caioAttentionFieldLabel(common.english, "committedDueAt")}
        {/* Local wall time can differ between server render and browser; the hidden field carries the instant. */}
        <input type="datetime-local" value={dueLocal} onChange={(event) => setDueLocal(event.target.value)} className={field} suppressHydrationWarning />
      </label>
      <input type="hidden" name="committedDueAt" value={toIso(dueLocal)} suppressHydrationWarning />
      <div className="text-sm" data-testid="caio-attention-confirm-diff">
        <p className="font-medium">{copy.diffTitle}</p>
        {changes.length === 0 ? <p>{copy.noDiff}</p> : (
          <ul className="list-disc pl-5">
            {changes.map((change) => (
              <li key={change.field}>
                {caioAttentionFieldLabel(common.english, change.field)}:{" "}
                {change.field === "committedDueAt"
                  ? `${toLocalInput(change.before[0] ?? null) || copy.none} → ${dueLocal || copy.none}`
                  : `${change.before.map(label).join(joiner) || copy.none} → ${change.after.map(label).join(joiner) || copy.none}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" disabled={pending} className="border px-3 py-1 text-sm">{pending ? copy.submitting : copy.confirmSubmit}</button>
      <Outcome state={state} english={common.english} />
    </form>
  );
}

export function CaioAttentionOperationForm({
  common,
  kind,
  review,
}: {
  common: CaioAttentionFormCommon;
  kind: "ack" | "note" | "disposition" | "review";
  review?: Readonly<{ dispositionId: string; reviewerVersion: number; externalRefs: readonly string[] }>;
}) {
  const copy = caioAttentionCopy(common.english);
  const [state, action, pending] = useCaioAttentionCommandAction();
  const [disposedLocal, setDisposedLocal] = useState("");
  const submit = (text: string, op?: string) => (
    <button type="submit" name={op ? "op" : undefined} value={op} disabled={pending} className="border px-3 py-1 text-sm">{pending ? copy.submitting : text}</button>
  );
  return (
    <form action={action} className="space-y-2 border border-[color:var(--border)] px-4 py-3" data-testid={`caio-attention-${kind}-form`}>
      <Identity common={common} op={kind === "ack" ? "ack" : kind === "note" ? "note" : kind === "disposition" ? "submitDisposition" : undefined} />
      {kind === "ack" ? submit(copy.ackSubmit) : null}
      {kind === "note" ? (
        <>
          <label className="block text-sm">{copy.noteTitle}<textarea name="text" required maxLength={2000} className={field} /></label>
          {submit(copy.noteSubmit)}
        </>
      ) : null}
      {kind === "disposition" ? (
        <>
          <h3 className="font-medium">{copy.dispositionTitle}</h3>
          <label className="block text-sm">{copy.outcome}
            <select name="outcome" required className={field}>
              {CAIO_ATTENTION_DISPOSITION_OUTCOMES.map((value) => <option key={value} value={value}>{caioAttentionOutcomeLabel(common.english, value)}</option>)}
            </select>
          </label>
          <label className="block text-sm">{copy.actionTaken}<textarea name="actionTaken" required maxLength={2000} className={field} /></label>
          <label className="block text-sm">{copy.note}<textarea name="note" maxLength={2000} className={field} /></label>
          <label className="block text-sm">{copy.evidence}<textarea name="evidenceRefs" className={field} placeholder={copy.evidenceHint} /></label>
          <label className="block text-sm">{copy.disposedAt}
            <input type="datetime-local" required value={disposedLocal} onChange={(event) => setDisposedLocal(event.target.value)} className={field} />
          </label>
          <input type="hidden" name="disposedAt" value={toIso(disposedLocal)} />
          {submit(copy.dispositionSubmit)}
        </>
      ) : null}
      {kind === "review" && review ? (
        <>
          <h3 className="font-medium">{copy.reviewTitle}</h3>
          <input type="hidden" name="dispositionId" value={review.dispositionId} />
          <input type="hidden" name="reviewerVersion" value={review.reviewerVersion} />
          {review.externalRefs.length > 0 ? (
            <fieldset className="text-sm"><legend>{copy.attestHint}</legend>
              {review.externalRefs.map((ref) => (
                <label key={ref} className="flex items-center gap-1"><input type="checkbox" name="attestedExternalRefs" value={ref} /><code>{ref}</code></label>
              ))}
            </fieldset>
          ) : null}
          <label className="block text-sm">{copy.reviewNote}<textarea name="note" required maxLength={2000} className={field} /></label>
          <div className="flex gap-3">{submit(copy.reviewAccept, "reviewAccept")}{submit(copy.reviewReturn, "reviewReturn")}</div>
        </>
      ) : null}
      <Outcome state={state} english={common.english} />
    </form>
  );
}
