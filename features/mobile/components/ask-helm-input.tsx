/**
 * Ask Helm Input Component for Mobile
 *
 * Mobile-optimized Ask Helm input with preset prompts.
 */

import { ArrowRight, MessageSquareText } from "lucide-react";
import Link from "next/link";
import type { AskHelmPresetPrompt } from "../types";
import { cn } from "@/lib/utils";

export interface AskHelmInputProps {
  defaultValue?: string;
  actionHref?: string;
  english?: boolean;
  presetPrompts?: AskHelmPresetPrompt[];
}

const DEFAULT_PRESET_PROMPTS_CN: AskHelmPresetPrompt[] = [
  { label: "今天先推进什么？", query: "今天先推进什么？" },
  { label: "客户在等回复", query: "上报：客户在等回复，需要复核下一步" },
  { label: "会议有新承诺", query: "上报：会议里出现新的客户承诺，需要复核" },
  { label: "交付遇到阻塞", query: "上报：交付遇到阻塞，需要负责人介入" },
  { label: "回复前要复核", query: "回复客户前哪些内容需要我复核？" },
];

const DEFAULT_PRESET_PROMPTS_EN: AskHelmPresetPrompt[] = [
  { label: "What should I work on first today?", query: "What should I work on first today?" },
  { label: "Customer waiting", query: "Report: customer is waiting and next step needs review" },
  { label: "Meeting promise", query: "Report: new customer commitment from a meeting needs review" },
  { label: "Delivery blocker", query: "Report: delivery is blocked and owner intervention is needed" },
  { label: "Review before reply", query: "What needs review before we reply to the customer?" },
];

export function AskHelmInput({
  defaultValue = "",
  actionHref = "/mobile",
  english = false,
  presetPrompts,
}: AskHelmInputProps) {
  const prompts = presetPrompts ?? (english ? DEFAULT_PRESET_PROMPTS_EN : DEFAULT_PRESET_PROMPTS_CN);
  const placeholder = english
    ? "Ask work, or report customer / meeting / delivery / commitment / blocker signals"
    : "问经营问题，或上报客户 / 会议 / 交付 / 承诺 / 阻塞信号";

  return (
    <div className="space-y-3">
      {/* Input form */}
      <form action={actionHref} method="get" className="relative">
        <MessageSquareText className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--muted-foreground)] pointer-events-none" />
        <input
          type="text"
          name="q"
          aria-label={english ? "Ask Helm question or signal" : "问 Helm 问题或经营信号"}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cn(
            "w-full h-12 pl-11 pr-12 rounded-2xl border border-[color:var(--border)]",
            "bg-[color:var(--surface)] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]",
            "text-base"
          )}
        />
        <button
          type="submit"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "flex h-8 w-8 items-center justify-center rounded-xl",
            "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]",
            "hover:bg-[var(--accent)]/90 active:scale-95",
            "transition-transform"
          )}
          aria-label={english ? "Ask or submit" : "提问或上报"}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div
        className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--muted-foreground)]"
        data-testid="mobile-ask-helm-boundary-note"
      >
        {english
          ? "Work-related signals go to review first. Helm will not send, commit, or write CRM from this box."
          : "工作信号会先进入人工确认，再决定是否继续推进。"}
      </div>

      {/* Preset prompts */}
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, index) => (
          <Link
            key={index}
            href={`${actionHref}?q=${encodeURIComponent(prompt.query)}`}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
              "bg-[color:var(--surface-subtle)] text-[color:var(--foreground)] text-sm",
              "hover:bg-[color:var(--border)] active:bg-[color:var(--surface-subtle)]",
              "transition-colors touch-manipulation"
            )}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            <span>{prompt.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
