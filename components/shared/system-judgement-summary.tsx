/**
 * The `<summary>` row for an object-first view's single closing
 * `<details data-system-judgement>` block. The `<details>` element itself
 * stays in the view file so the object-first guard can find it.
 */
export function SystemJudgementSummary({ english }: { english: boolean }) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-[color:var(--foreground)]">
      <span>{english ? "System judgement" : "系统判断"}</span>
      <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)] transition group-open:bg-[color:var(--surface-subtle)]">
        <span className="group-open:hidden">{english ? "Show" : "展开"}</span>
        <span className="hidden group-open:inline">{english ? "Hide" : "收起"}</span>
      </span>
    </summary>
  );
}

export const systemJudgementDetailsClassName =
  "group rounded-[26px] border border-[color:var(--border)] bg-[color:var(--background-elevated)]";
