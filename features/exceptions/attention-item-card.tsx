import type { AttentionItem } from "@/lib/shell/attention-feed";

import { SEVERITY_COPY, t } from "./attention-copy";

const TONE_CLASS: Record<"danger" | "caution" | "neutral", string> = {
  danger: "bg-[color:var(--status-danger-bg,#fee2e2)] text-[color:var(--status-danger-text,#991b1b)]",
  caution: "bg-[color:var(--status-warning-bg,#fef9c3)] text-[color:var(--status-warning-text,#854d0e)]",
  neutral: "bg-[color:var(--surface-subtle)] text-[color:var(--muted-foreground)]",
};

/**
 * 单条异常条目只读卡。severity 徽标(信息性)+ 脱敏 label + roleCategory;href 只导航到
 * 既有人审流程(**无处置/执行按钮**)。
 */
export function AttentionItemCard({ item, english }: { item: AttentionItem; english: boolean }) {
  const sev = SEVERITY_COPY[item.severity];
  const body = (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[sev?.tone ?? "neutral"]}`}>
        {t(sev ?? { zh: item.severity, en: item.severity }, english)}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm text-[color:var(--foreground)]">{item.label}</p>
        <p className="text-xs text-[color:var(--muted-foreground)]">{item.roleCategory}</p>
      </div>
    </div>
  );
  return (
    <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      {item.href ? (
        <a href={item.href} className="block hover:opacity-90" aria-label={item.label}>
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}
