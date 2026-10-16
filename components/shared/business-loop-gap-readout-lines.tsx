import Link from "next/link";
import type { BusinessLoopGapSurfaceReadout } from "@/lib/presentation/business-loop-gap-readout";

/**
 * The workspace loop-gap readout as plain lines. Object-first queue pages
 * render it only inside their single closing `<details data-system-judgement>`
 * block; it renders nothing when there is no open loop gap.
 *
 * 闭环缺口读数。对象优先的队列页只在末尾唯一的系统判断块里渲染它；
 * 没有未关闭的闭环缺口时不渲染。
 */
export function BusinessLoopGapReadoutLines({
  readout,
  english,
}: {
  readout: BusinessLoopGapSurfaceReadout;
  english: boolean;
}) {
  if (!readout.primaryGap) return null;

  const rows = [
    { key: "blocker", label: english ? "Blocker" : "阻塞", value: readout.blocker },
    {
      key: "decision",
      label: english ? "Pending decision" : "待决策",
      value: readout.pendingDecision,
    },
    { key: "next", label: english ? "Next action" : "下一步", value: readout.nextAction },
  ].filter((row): row is { key: string; label: string; value: string } =>
    Boolean(row.value),
  );
  const connection = readout.connection;

  return (
    <section
      data-business-loop-gap-readout="true"
      className="space-y-2 rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm"
    >
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {connection?.label ?? (english ? "Loop gap" : "闭环缺口")}
      </p>
      {rows.length ? (
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.key}>
              <dt className="text-xs text-[color:var(--muted-foreground)]">{row.label}</dt>
              <dd className="mt-0.5 break-words text-[color:var(--foreground)]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {connection ? (
        <p className="break-words text-[color:var(--muted-foreground)]">
          {connection.href ? (
            <Link
              href={connection.href}
              className="font-medium text-[color:var(--accent)] underline-offset-4 hover:underline"
            >
              {connection.value}
            </Link>
          ) : (
            <span className="font-medium text-[color:var(--foreground)]">{connection.value}</span>
          )}
          {" · "}
          {connection.description}
        </p>
      ) : null}
    </section>
  );
}
