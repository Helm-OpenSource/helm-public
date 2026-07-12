"use client";

import type { ReactNode } from "react";

import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  LlmV3ReviewReadout,
  LlmV3ReviewReadoutResult,
} from "@/lib/llm/v3-review-readout";

type LlmReviewPanelProps = {
  readonly result: LlmV3ReviewReadoutResult;
  readonly english: boolean;
};

type Copy = {
  readonly zh: string;
  readonly en: string;
};

const TAB_COPY = {
  judgement: { zh: "判断候选", en: "Judgement" },
  source: { zh: "信号映射", en: "Signal mapping" },
  trajectory: { zh: "任务轨迹", en: "Task trajectory" },
  boundary: { zh: "多轮边界", en: "Multi-pass boundary" },
} satisfies Record<string, Copy>;

function pick(copy: Copy, english: boolean): string {
  return english ? copy.en : copy.zh;
}

function statusVariant(
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["pass", "candidate", "allow_candidate", "success"].includes(status)) {
    return "success";
  }
  if (["fail", "rejected_by_guard", "reject", "quarantine"].includes(status)) {
    return "danger";
  }
  if (["needs_review", "review_required", "inconclusive"].includes(status)) {
    return "warning";
  }
  if (status === "public_safe_synthetic") return "info";
  return "neutral";
}

function StatusBadge({ value }: { readonly value: string }) {
  return (
    <Badge variant={statusVariant(value)} className="w-fit font-mono">
      {value}
    </Badge>
  );
}

function EvidenceRefs({
  refs,
  emptyCopy,
}: {
  readonly refs: readonly string[];
  readonly emptyCopy: string;
}) {
  if (refs.length === 0) {
    return <p className="text-sm text-[color:var(--muted-foreground)]">{emptyCopy}</p>;
  }

  return (
    <ul className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
      {refs.map((ref) => (
        <li key={ref} className="min-w-0 py-2.5 font-mono text-xs leading-5">
          <span className="break-all">{ref}</span>
        </li>
      ))}
    </ul>
  );
}

function DefinitionGrid({
  items,
}: {
  readonly items: readonly {
    readonly label: string;
    readonly value: ReactNode;
  }[];
}) {
  return (
    <dl className="grid min-w-0 grid-cols-1 border-y border-[color:var(--border)] sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="min-w-0 border-b border-[color:var(--border)] px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
        >
          <dt className="text-xs text-[color:var(--muted-foreground)]">{item.label}</dt>
          <dd className="mt-1 min-w-0 break-words text-sm font-medium leading-6">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReadoutHeader({
  eyebrow,
  title,
  description,
  badges,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly badges: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-3 border-b border-[color:var(--border)] px-4 py-4 sm:px-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-[color:var(--accent)]">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold leading-7">{title}</h2>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5 sm:justify-end">{badges}</div>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
        {description}
      </p>
    </header>
  );
}

function JudgementPanel({
  readout,
  english,
}: {
  readonly readout: LlmV3ReviewReadout;
  readonly english: boolean;
}) {
  const proposal = readout.judgementProposal;

  return (
    <section
      className="min-h-[34rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
      data-testid="llm-review-panel-judgement"
    >
      <ReadoutHeader
        eyebrow={english ? "Evidence 01 · proposal bundle" : "证据 01 · 判断提案包"}
        title={english ? "Judgement candidate" : "经营判断候选"}
        description={
          english
            ? "A typed candidate with evidence, gaps, counter-evidence needs, and safe next steps. It has no approval authority."
            : "带证据、缺口、反证需求与安全下一步的类型化候选；它不拥有批准权限。"
        }
        badges={
          <>
            <StatusBadge value={proposal.reviewState} />
            <Badge variant="neutral">{proposal.confidence}% confidence</Badge>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <DefinitionGrid
          items={[
            {
              label: english ? "Proposal ID" : "提案 ID",
              value: <code className="break-all text-xs">{proposal.proposalId}</code>,
            },
            {
              label: english ? "Object" : "对象",
              value: `${proposal.objectRef.objectType} · ${proposal.objectRef.objectId}`,
            },
            {
              label: english ? "Review posture" : "复核姿态",
              value: proposal.reviewState,
            },
            {
              label: english ? "Approval" : "批准状态",
              value: english ? "Not granted" : "未授予",
            },
          ]}
        />

        <section aria-labelledby="judgement-evidence-heading">
          <h3 id="judgement-evidence-heading" className="mb-2 text-sm font-semibold">
            {english ? "Evidence references" : "证据引用"}
          </h3>
          <EvidenceRefs
            refs={proposal.evidenceRefs}
            emptyCopy={english ? "No evidence references." : "无证据引用。"}
          />
        </section>

        <section aria-labelledby="judgement-gaps-heading">
          <h3 id="judgement-gaps-heading" className="mb-2 text-sm font-semibold">
            {english ? "Missing evidence" : "缺失证据"}
          </h3>
          <ul className="space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {proposal.missingEvidence.map((gap) => (
              <li key={gap.gapId} className="border-l-2 border-[color:var(--status-warning-border)] pl-3">
                <code className="mr-2 break-all text-xs">{gap.gapId}</code>
                {gap.missingSignalNote}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <LazyDisclosure
        title={
          english
            ? "Counter-evidence and review-safe next steps"
            : "反证需求与仅供复核的安全下一步"
        }
        quote={false}
        data-testid="llm-review-disclosure-judgement"
        className="rounded-none border-x-0 border-b-0 bg-transparent px-4 py-4 sm:px-5"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">
              {english ? "Counter-evidence needed" : "仍需核对的反证"}
            </h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {proposal.counterEvidenceNeeded.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {english ? "Candidate-only next steps" : "仅限候选的下一步"}
            </h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {proposal.nextSafeActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </LazyDisclosure>
    </section>
  );
}

function SourceProposalPanel({
  readout,
  english,
}: {
  readonly readout: LlmV3ReviewReadout;
  readonly english: boolean;
}) {
  const proposal = readout.sourceToSignalProposal;

  return (
    <section
      className="min-h-[34rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
      data-testid="llm-review-panel-source"
    >
      <ReadoutHeader
        eyebrow={english ? "Evidence 02 · source proposal" : "证据 02 · 源到信号提案"}
        title={english ? "Source-to-signal candidate" : "源到经营信号候选"}
        description={
          english
            ? "A synthetic schema summary mapped to a Helm signal family. Provenance is explicit and every write capability remains forbidden."
            : "把合成 schema 摘要映射到 Helm 信号族；来源明确，所有写能力仍被禁止。"
        }
        badges={
          <>
            <StatusBadge value={proposal.reviewState} />
            <StatusBadge value={proposal.redactionProvenance} />
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <DefinitionGrid
          items={[
            {
              label: english ? "Candidate origin" : "候选来源",
              value: proposal.candidateOrigin,
            },
            {
              label: english ? "Candidate ref" : "候选引用",
              value: <code className="break-all text-xs">{proposal.sourceCandidateRef}</code>,
            },
            {
              label: english ? "Model profile" : "模型档案",
              value: <code className="break-all text-xs">{proposal.modelProfileKey}</code>,
            },
            {
              label: english ? "Confidence" : "置信度",
              value: `${proposal.confidence}%`,
            },
          ]}
        />

        <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section aria-labelledby="source-map-heading">
            <h3 id="source-map-heading" className="text-sm font-semibold">
              {english ? "Candidate mapping" : "候选映射"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              <code className="break-all">{proposal.sourceSummaryRefs.join(", ")}</code>
              <span className="mx-2" aria-hidden>→</span>
              <strong className="text-[color:var(--foreground)]">
                {proposal.targetEntity} / {proposal.targetSignalFamily}
              </strong>
            </p>
          </section>
          <section aria-labelledby="source-rationale-heading">
            <h3 id="source-rationale-heading" className="text-sm font-semibold">
              {english ? "Mapping rationale" : "映射依据"}
            </h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {proposal.mappingRationale.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="source-evidence-heading">
          <h3 id="source-evidence-heading" className="mb-2 text-sm font-semibold">
            {english ? "Grounded evidence references" : "已落地的证据引用"}
          </h3>
          <EvidenceRefs
            refs={proposal.evidenceRefs}
            emptyCopy={english ? "No grounded evidence." : "无已落地证据。"}
          />
        </section>
      </div>

      <LazyDisclosure
        title={
          english
            ? "Forbidden capabilities and unresolved evidence"
            : "禁止能力与未解决证据"
        }
        quote={false}
        data-testid="llm-review-disclosure-source"
        className="rounded-none border-x-0 border-b-0 bg-transparent px-4 py-4 sm:px-5"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {proposal.forbiddenCapabilityRefs.map((capability) => (
              <Badge key={capability} variant="danger" className="font-mono">
                {capability}
              </Badge>
            ))}
          </div>
          {proposal.missingEvidence.map((gap) => (
            <p key={gap.gapId} className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              <code className="mr-2 text-xs">{gap.gapId}</code>
              {gap.missingSignalNote}
            </p>
          ))}
        </div>
      </LazyDisclosure>
    </section>
  );
}

function TrajectoryPanel({
  readout,
  english,
}: {
  readonly readout: LlmV3ReviewReadout;
  readonly english: boolean;
}) {
  const receipt = readout.trajectoryReceipt;
  const evaluation = readout.trajectoryEvaluation;

  return (
    <section
      className="min-h-[34rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
      data-testid="llm-review-panel-trajectory"
    >
      <ReadoutHeader
        eyebrow={english ? "Evidence 03 · deterministic eval" : "证据 03 · 确定性评估"}
        title={english ? "LLM task trajectory" : "LLM 任务轨迹"}
        description={
          english
            ? "The receipt records public-safe summaries only. The verdict and failures are recomputed by the deterministic evaluator, never trusted from fixture claims."
            : "回执只记录 public-safe 摘要；verdict 与 failures 由确定性 evaluator 重新计算，不信任 fixture 自报。"
        }
        badges={
          <>
            <StatusBadge value={evaluation.verdict} />
            <Badge variant={evaluation.failures.length === 0 ? "success" : "danger"}>
              {evaluation.failures.length} {english ? "failures" : "个 failures"}
            </Badge>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <DefinitionGrid
          items={[
            {
              label: english ? "Receipt ID" : "回执 ID",
              value: <code className="break-all text-xs">{receipt.receiptId}</code>,
            },
            {
              label: english ? "Model profile" : "模型档案",
              value: <code className="break-all text-xs">{receipt.modelProfileKey}</code>,
            },
            {
              label: english ? "Deterministic verdict" : "确定性 verdict",
              value: evaluation.verdict,
            },
            {
              label: english ? "Deterministic failures" : "确定性 failures",
              value:
                evaluation.failures.length === 0
                  ? english
                    ? "None"
                    : "无"
                  : evaluation.failures.join(", "),
            },
          ]}
        />

        <ol className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
          {receipt.steps.map((step, index) => (
            <li
              key={step.stepId}
              className="grid min-w-0 gap-2 py-3 sm:grid-cols-[2.5rem_minmax(0,0.75fr)_minmax(0,1.5fr)_auto] sm:items-start"
            >
              <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-semibold">{step.stepType}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-[color:var(--muted-foreground)]">
                  {step.stepId}
                </p>
              </div>
              <p className="min-w-0 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {step.summary}
              </p>
              <Badge variant={step.blocked ? "danger" : "neutral"} className="w-fit font-mono">
                {step.riskClass}
              </Badge>
            </li>
          ))}
        </ol>
      </div>

      <LazyDisclosure
        title={english ? "Final claim flags" : "最终声明标志"}
        quote={false}
        data-testid="llm-review-disclosure-trajectory"
        className="rounded-none border-x-0 border-b-0 bg-transparent px-4 py-4 sm:px-5"
      >
        <DefinitionGrid
          items={Object.entries(receipt.finalClaim).map(([key, value]) => ({
            label: key,
            value: value ? (english ? "Yes" : "是") : english ? "No" : "否",
          }))}
        />
      </LazyDisclosure>
    </section>
  );
}

function MultiPassPanel({
  readout,
  english,
}: {
  readonly readout: LlmV3ReviewReadout;
  readonly english: boolean;
}) {
  const receipt = readout.multiPassBoundaryReceipt;

  return (
    <section
      className="min-h-[34rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
      data-testid="llm-review-panel-boundary"
    >
      <ReadoutHeader
        eyebrow={english ? "Evidence 04 · boundary receipt" : "证据 04 · 边界回执"}
        title={english ? "Multi-pass boundary receipt" : "多轮复核边界回执"}
        description={
          english
            ? "Generator, critic, and adversary may agree on a candidate. The deterministic arbiter still grants no approval or side-effect authority."
            : "generator、critic 与 adversary 可以对候选达成一致；确定性 arbiter 仍不授予批准或副作用权限。"
        }
        badges={
          <>
            <StatusBadge value={receipt.boundaryDecision} />
            <Badge variant="neutral" className="font-mono">{receipt.reason}</Badge>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <DefinitionGrid
          items={[
            {
              label: english ? "Profile" : "模型档案",
              value: <code className="break-all text-xs">{receipt.profileKey}</code>,
            },
            {
              label: english ? "Provider mode" : "Provider 模式",
              value: receipt.providerMode,
            },
            {
              label: english ? "Reasoning" : "推理档位",
              value: `${receipt.budgetDecision.reasoningDepth} / ${receipt.budgetDecision.budgetClass}`,
            },
            {
              label: english ? "Approval" : "批准状态",
              value: english ? "Not granted" : "未授予",
            },
          ]}
        />

        <section aria-labelledby="role-calls-heading">
          <h3 id="role-calls-heading" className="mb-2 text-sm font-semibold">
            {english ? "Role call receipts" : "角色调用回执"}
          </h3>
          <div className="grid border-y border-[color:var(--border)] sm:grid-cols-3">
            {receipt.roleCalls.map((roleCall) => (
              <div
                key={roleCall.role}
                className="min-w-0 border-b border-[color:var(--border)] px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold">{roleCall.role}</p>
                  <StatusBadge value={roleCall.success ? "success" : "fail"} />
                </div>
                <p className="mt-2 break-all font-mono text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {roleCall.promptVersion}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="egress-heading">
          <h3 id="egress-heading" className="text-sm font-semibold">
            {english ? "Egress receipt" : "外发边界回执"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "Remote egress was not used. No prompt preview, customer material, tenant URL, or production receipt is present."
              : "未使用远程 egress；不包含 prompt preview、客户材料、tenant URL 或生产回执。"}
          </p>
          <code className="mt-2 block break-all text-xs">{receipt.egress.blockedReason}</code>
        </section>
      </div>

      <LazyDisclosure
        title={english ? "Public-safety receipt flags" : "公开安全回执标志"}
        quote={false}
        data-testid="llm-review-disclosure-boundary"
        className="rounded-none border-x-0 border-b-0 bg-transparent px-4 py-4 sm:px-5"
      >
        <DefinitionGrid
          items={[
            {
              label: "rawPromptIncluded",
              value: String(receipt.rawPromptIncluded),
            },
            {
              label: "rawCustomerDataIncluded",
              value: String(receipt.rawCustomerDataIncluded),
            },
            {
              label: "tenantUrlIncluded",
              value: String(receipt.tenantUrlIncluded),
            },
            {
              label: "productionReceiptIncluded",
              value: String(receipt.productionReceiptIncluded),
            },
          ]}
        />
      </LazyDisclosure>
    </section>
  );
}

function ErrorPanel({
  result,
  english,
}: {
  readonly result: Exclude<LlmV3ReviewReadoutResult, { ok: true }>;
  readonly english: boolean;
}) {
  return (
    <section
      role="alert"
      data-testid="llm-v3-review-error"
      className="rounded-lg border-2 border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-5 py-4 text-[color:var(--status-danger-text)]"
    >
      <h2 className="text-base font-semibold">
        {english
          ? "Synthetic review fixture failed closed"
          : "合成 review fixture 已关闭失败"}
      </h2>
      <p className="mt-2 text-sm leading-6">
        {english
          ? "No partial proposal or receipt evidence was rendered. Repair the fixture and rerun strict validation."
          : "未渲染任何部分提案或回执证据。请修复 fixture 后重新运行严格校验。"}
      </p>
      <p className="mt-3 font-mono text-xs">{result.errorCode}</p>
      <ul className="mt-2 space-y-1 font-mono text-xs">
        {result.issuePaths.map((path) => (
          <li key={path} className="break-all">{path}</li>
        ))}
      </ul>
    </section>
  );
}

export function LlmReviewPanel({ result, english }: LlmReviewPanelProps) {
  if (!result.ok) {
    return <ErrorPanel result={result} english={english} />;
  }

  const decision = result.multiPassBoundaryReceipt.boundaryDecision;

  return (
    <section
      data-testid="llm-v3-review-panel"
      data-llm-review-readonly="true"
      data-llm-review-candidate-authority="candidate_only"
      data-llm-review-write-capability="none"
      className="min-w-0"
    >
      <div
        data-testid="llm-review-candidate-boundary"
        className="mb-5 grid min-w-0 gap-3 border-y border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
      >
        <StatusBadge value={decision} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {english
              ? "allow_candidate does not mean approved"
              : "allow_candidate 不等于已批准"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "It can enter a human review queue only. No external send, writeback, activation, or official promotion is authorized."
              : "它只可进入人工复核队列；未授权任何外发、写回、激活或正式晋级。"}
          </p>
        </div>
        <Badge
          variant={
            result.candidateBoundary.posture === "blocked_by_guard"
              ? "danger"
              : "approval"
          }
          className="w-fit"
        >
          {english ? "Human decision required" : "必须人工决定"}
        </Badge>
      </div>

      <Tabs defaultValue="judgement" data-testid="llm-review-tabs">
        <TabsList
          aria-label={english ? "LLM review evidence" : "LLM 复核证据"}
          className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg md:grid-cols-4"
        >
          {Object.entries(TAB_COPY).map(([value, copy]) => (
            <TabsTrigger
              key={value}
              value={value}
              data-testid={`llm-review-tab-${value}`}
              className="min-h-11 whitespace-normal rounded-md px-2 py-2 leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              {pick(copy, english)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="judgement" className="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
          <JudgementPanel readout={result} english={english} />
        </TabsContent>
        <TabsContent value="source" className="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
          <SourceProposalPanel readout={result} english={english} />
        </TabsContent>
        <TabsContent value="trajectory" className="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
          <TrajectoryPanel readout={result} english={english} />
        </TabsContent>
        <TabsContent value="boundary" className="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]">
          <MultiPassPanel readout={result} english={english} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
