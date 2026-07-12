import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react";

import { BoundaryBar } from "@/components/shared/boundary-bar";
import { Badge } from "@/components/ui/badge";
import { LlmReviewPanel } from "@/features/llm-review/llm-review-panel";
import fixture from "@/lib/evals/fixtures/llm-v3-review.synthetic.json";
import { resolveUiLocale } from "@/lib/i18n/config";
import { buildV3ReviewReadout } from "@/lib/llm/v3-review-readout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english
      ? "Helm LLM V3 Review | Public synthetic"
      : "Helm LLM V3 复核 | 公开合成证据",
    description: english
      ? "A public synthetic, read-only reviewer for four Helm LLM V3 evidence receipts."
      : "公开合成、只读的 Helm LLM V3 四类证据复核界面。",
  };
}

export default async function LlmReviewPage() {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const result = buildV3ReviewReadout(fixture);

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 py-5 sm:px-6 lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Helm</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "LLM V3 evidence review" : "LLM V3 证据复核"}
          </p>
        </div>
        <Link
          href="/demo"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {english ? "Demo index" : "演示首页"}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 pb-16 sm:px-6 lg:px-10">
        <section className="border-b border-[color:var(--border)] pb-6 pt-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">PUBLIC SYNTHETIC</Badge>
            <Badge variant="neutral">READ ONLY</Badge>
            <Badge variant="approval">REVIEW FIRST</Badge>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <Eye className="mt-1 h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                {english ? "Helm LLM V3 Review" : "Helm LLM V3 只读复核"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)] sm:text-base">
                {english
                  ? "Inspect four typed, public-safe receipts from one synthetic candidate path. The page reads a committed fixture only; it has no database, API, action, analytics, or provider connection."
                  : "查看同一条合成候选路径上的四类 public-safe 类型化回执。本页只读取仓库 fixture，不连接数据库、API、action、analytics 或模型 provider。"}
              </p>
            </div>
          </div>
        </section>

        <BoundaryBar
          english={english}
          copy={{
            observed: {
              zh: "四类公开合成证据：判断候选、源到信号候选、任务轨迹与多轮边界回执。",
              en: "Four public synthetic evidence types: judgement, source-to-signal, task trajectory, and multi-pass boundary receipts.",
            },
            wontDo: {
              zh: "本页不批准、不拒绝、不应用、不导入、不发送、不写回、不晋级，也不激活任何能力。",
              en: "This page does not approve, reject, apply, import, send, write back, promote, or activate anything.",
            },
            decider: {
              zh: "人工 reviewer 决定候选是否继续；allow_candidate 仍然不是批准。",
              en: "A human reviewer decides whether a candidate proceeds; allow_candidate is still not approval.",
            },
            negatives: [
              { zh: "无数据库读取", en: "No database read" },
              { zh: "无网络写请求", en: "No network mutation" },
              { zh: "无自动外发", en: "No automatic send" },
              { zh: "无正式状态写入", en: "No official state write" },
            ],
          }}
        />

        <LlmReviewPanel result={result} english={english} />

        <footer className="flex flex-col gap-3 border-t border-[color:var(--border)] py-5 text-xs leading-6 text-[color:var(--muted-foreground)] sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-3xl items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
            <p>
              {english
                ? "Synthetic evidence only. This is not a customer receipt, production attestation, model endorsement, release approval, or external commitment."
                : "仅含合成证据。它不是客户回执、生产证明、模型背书、发布批准或外部承诺。"}
            </p>
          </div>
          {result.ok ? (
            <p className="shrink-0 font-mono">
              {result.fixtureVersion} · {result.ruleVersion}
            </p>
          ) : (
            <p className="shrink-0 font-mono">{result.errorCode}</p>
          )}
        </footer>
      </main>
    </div>
  );
}
