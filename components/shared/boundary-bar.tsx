import {
  BOUNDARY_BAR_SEGMENT_LABELS,
  resolveBoundaryBarCopy,
  type BoundaryBarCopyInput,
} from "@/lib/design-language/boundary-bar-copy";

/**
 * Page-level boundary declaration bar (NPA-pack design language, Core port).
 *
 * Three segments — what you see / what the system will not do / who decides
 * next — plus an explicit negative list. Fail-closed: invalid copy renders a
 * visible danger state with an error code instead of default wording.
 * Server-component compatible; pass `english` like other bilingual surfaces.
 */
export function BoundaryBar({
  copy,
  english,
  className,
}: {
  copy: BoundaryBarCopyInput;
  english: boolean;
  className?: string;
}) {
  const resolution = resolveBoundaryBarCopy(copy, english);

  if (!resolution.ok) {
    return (
      <div
        data-boundary-bar="error"
        data-boundary-error-code={resolution.errorCode}
        role="alert"
        className={`rounded-lg border-2 border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-4 py-3 text-sm text-[color:var(--status-danger-text)] ${className ?? ""}`}
      >
        <span className="font-semibold">
          {english ? "Boundary copy invalid" : "边界文案无效"}
        </span>
        <span className="ml-2 font-mono text-xs">
          {resolution.errorCode} · {resolution.missingFields.join(", ")}
        </span>
      </div>
    );
  }

  const segments = [
    { key: "observed", label: BOUNDARY_BAR_SEGMENT_LABELS.observed, text: resolution.observed },
    { key: "wontDo", label: BOUNDARY_BAR_SEGMENT_LABELS.wontDo, text: resolution.wontDo },
    { key: "decider", label: BOUNDARY_BAR_SEGMENT_LABELS.decider, text: resolution.decider },
  ] as const;

  return (
    <div
      data-boundary-bar="ok"
      className={`rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 ${className ?? ""}`}
    >
      <dl className="flex flex-col gap-2 text-sm md:flex-row md:items-start md:gap-6">
        {segments.map((segment) => (
          <div key={segment.key} className="flex min-w-0 flex-1 flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
              {english ? segment.label.en : segment.label.zh}
            </dt>
            <dd className="text-[color:var(--foreground)]">{segment.text}</dd>
          </div>
        ))}
      </dl>
      {resolution.negatives.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {resolution.negatives.map((item) => (
            <li
              key={item}
              data-boundary-negative-item
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-xs text-[color:var(--muted-foreground)]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
