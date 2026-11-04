import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import {
  caioAttentionCategoryLabel,
  caioAttentionCopy,
  caioAttentionFieldLabel,
  caioAttentionRoleLabel,
  caioAttentionSeverityLabel,
  caioAttentionStatusLabel,
} from "@/features/caio-attention/copy";
import { getCaioAttentionPageContext } from "@/features/caio-attention/page-context";
import { getCaioAttentionPageService } from "@/features/caio-attention/service";
import type { CaioAttentionCommandFields } from "@/features/caio-attention/service-contract";
import { diffCaioAttentionCommand } from "@/features/caio-attention/view-model";
import { formatLocalizedDateLabel } from "@/lib/i18n/date-labels";

// Case detail: object, then the confirmed command and its changes from the prefill, then receipts, reviews and
// events. The loader decides visibility; anyone it refuses gets the same not-found page as a missing case.
export default async function CaioAttentionCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const [{ english, viewer }, { caseId }] = await Promise.all([getCaioAttentionPageContext(), params]);
  const loaded = await getCaioAttentionPageService().loadCase({ viewer, caseId, sourcePage: "/caio/attention/[caseId]" });
  if (!loaded.ok) notFound();
  const view = loaded.view;
  const copy = caioAttentionCopy(english);
  const person = (id: string | null) => (id ? (view.people[id] ?? id) : copy.none);
  const people = (ids: readonly string[]) => (ids.length > 0 ? ids.map((id) => person(id)).join("、") : copy.none);
  const date = (value: Date | null) => (value ? formatLocalizedDateLabel(value, english) : copy.none);
  const commandRows = (fields: CaioAttentionCommandFields) => (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 text-sm">
      <dt>{caioAttentionFieldLabel(english, "primaryUserId")}</dt><dd>{person(fields.primaryUserId)}</dd>
      <dt>{caioAttentionFieldLabel(english, "ccUserIds")}</dt><dd>{people(fields.ccUserIds)}</dd>
      <dt>{caioAttentionFieldLabel(english, "escalationUserId")}</dt><dd>{person(fields.escalationUserId)}</dd>
      <dt>{caioAttentionFieldLabel(english, "reviewerUserIds")}</dt><dd>{people(fields.reviewerUserIds)}</dd>
      <dt>{caioAttentionFieldLabel(english, "committedDueAt")}</dt><dd>{date(fields.committedDueAt)}</dd>
    </dl>
  );
  const changes = view.command ? diffCaioAttentionCommand(view.prefill, view.command) : [];

  return (
    <div className="space-y-6" data-source-page="/caio/attention/[caseId]" data-case-status={view.status}>
      <PageHeader
        english={english}
        eyebrow={copy.eyebrow}
        title={`#${view.shortNo} · ${caioAttentionSeverityLabel(english, view.effectiveSeverity)} · ${caioAttentionCategoryLabel(english, view.category)}`}
        description={`${copy.status}: ${caioAttentionStatusLabel(english, view.status)}`}
      />
      <section aria-label={copy.object} className="space-y-1 text-sm" data-testid="caio-attention-object">
        <p>{copy.detector}: <code>{view.detectorId}</code></p>
        <p>{copy.object}: <code>{view.objectKey}</code></p>
        {view.enterpriseSlug ? <p>{copy.enterprise}: <code>{view.enterpriseSlug}</code></p> : null}
        <p>{copy.createdAt}: {date(view.createdAt)} · {copy.dispatchedAt}: {date(view.dispatchedAt)}</p>
        <p>{copy.yourRoles}: {view.viewerRoles.map((role) => caioAttentionRoleLabel(english, role)).join(" / ") || copy.none}</p>
        {view.routingBlocked ? <p data-testid="caio-attention-routing-blocked">{copy.routingBlocked}: {view.routingBlockedReasons.join(", ")}</p> : null}
        <p className="text-xs text-[color:var(--text-muted)]">{copy.notBusinessOutcome}</p>
      </section>
      {view.command ? (
        <section className="space-y-2" data-testid="caio-attention-command">
          <h2 className="font-semibold">{copy.commandTitle} · {copy.commandVersion(view.commandVersion)}</h2>
          {commandRows(view.command)}
          <h3 className="text-sm font-medium">{copy.diffTitle}</h3>
          {changes.length === 0 ? <p className="text-sm">{copy.noDiff}</p> : (
            <ul className="list-disc pl-5 text-sm" data-testid="caio-attention-diff">
              {changes.map((change) => (
                <li key={change.field}>
                  {caioAttentionFieldLabel(english, change.field)}: {change.field === "committedDueAt"
                    ? `${date(view.prefill.committedDueAt)} → ${date(view.command?.committedDueAt ?? null)}`
                    : `${people(change.before)} → ${people(change.after)}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-2" data-testid="caio-attention-prefill">
          <h2 className="font-semibold">{copy.prefillTitle}</h2>
          {commandRows(view.prefill)}
        </section>
      )}
      {view.dispositions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">{copy.dispositionsTitle}</h2>
          {view.dispositions.map((item) => (
            <article key={item.id} className="border border-[color:var(--border)] px-4 py-3 text-sm" data-superseded={item.superseded}>
              <p>{copy.commandVersion(item.commandVersion)} · #{item.sequence} · {person(item.submittedByUserId)} · {date(item.disposedAt)}</p>
              <p>{copy.outcome}: {item.outcome}</p>
              <p>{copy.actionTaken}: {item.actionTaken}</p>
              {item.note ? <p>{copy.note}: {item.note}</p> : null}
              <p>{copy.evidence}: {item.evidenceRefs.length > 0 ? item.evidenceRefs.join(", ") : copy.none}</p>
              {item.superseded ? <p className="text-xs">{copy.superseded}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
      {view.reviews.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">{copy.reviewsTitle}</h2>
          {view.reviews.map((review) => (
            <p key={review.id} className="text-sm">
              {copy.decision(review.decision === "ACCEPT")} · {person(review.reviewerUserId)} · {date(review.createdAt)} · {review.note}
            </p>
          ))}
        </section>
      ) : null}
      <section className="space-y-1">
        <h2 className="font-semibold">{copy.eventsTitle}</h2>
        <ol className="text-xs text-[color:var(--text-muted)]">
          {view.events.map((event) => (
            <li key={event.id}>
              {date(event.createdAt)} · <code>{event.kind}</code>
              {event.commandVersion !== null ? ` · ${copy.commandVersion(event.commandVersion)}` : null}
              {event.actorUserId ? ` · ${person(event.actorUserId)}` : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
