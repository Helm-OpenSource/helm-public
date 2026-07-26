"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Stage1OwnerDecisionQueueItem } from "./stage1-decision-queue-loader";

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function tomorrowLocal() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function Stage1DecisionQueue({
  available,
  decisions,
}: {
  available: boolean;
  decisions: Stage1OwnerDecisionQueueItem[];
}) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const router = useRouter();
  const [selected, setSelected] = useState<Stage1OwnerDecisionQueueItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [conclusion, setConclusion] = useState("");
  const [executionTargetRef, setExecutionTargetRef] = useState("team:sales");
  const [goal, setGoal] = useState("");
  const [workAction, setWorkAction] = useState("");
  const [dueAt, setDueAt] = useState(tomorrowLocal());
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [evidenceRequirements, setEvidenceRequirements] = useState("structured execution receipt\nindependent verifier confirmation");
  const [invalidationConditions, setInvalidationConditions] = useState("new conflicting evidence\ncustomer priority changes");
  const [escalationOwnerRef, setEscalationOwnerRef] = useState("role:owner");
  const [reviewReason, setReviewReason] = useState("");
  const [deferUntil, setDeferUntil] = useState(tomorrowLocal());

  if (!available) return null;

  function openDecision(decision: Stage1OwnerDecisionQueueItem) {
    setConclusion(decision.recommendedOption ?? "");
    setGoal(decision.businessQuestion);
    setWorkAction(decision.recommendedOption ?? "");
    setAcceptanceCriteria(
      decision.recommendedOption
        ? `Result matches: ${decision.recommendedOption}`
        : "",
    );
    setReviewReason("");
    setSelected(decision);
  }

  async function submit(action: "approve" | "reject" | "defer" | "request_evidence") {
    if (!selected) return;
    const dueDate = new Date(dueAt);
    const deferDate = new Date(deferUntil);
    if (
      (action === "approve" && Number.isNaN(dueDate.getTime())) ||
      (action === "defer" && Number.isNaN(deferDate.getTime()))
    ) {
      toast.error(english ? "Choose a valid date and time" : "请选择有效日期和时间");
      return;
    }
    const body = action === "approve"
      ? {
          action,
          conclusion,
          executionTargetRef,
          goal,
          workAction,
          dueAt: dueDate.toISOString(),
          acceptanceCriteria: lines(acceptanceCriteria),
          evidenceRequirements: lines(evidenceRequirements),
          invalidationConditions: lines(invalidationConditions),
          escalationOwnerRef,
        }
      : action === "defer"
        ? { action, reason: reviewReason, deferUntil: deferDate.toISOString() }
        : { action, reason: reviewReason };
    startTransition(async () => {
      const response = await fetch(`/api/stage1/decisions/${encodeURIComponent(selected.id)}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(english ? "Decision update was not accepted" : "决策更新未被接纳", {
          description: Array.isArray(result.reasons) ? result.reasons.join(" · ") : result.errorCode,
        });
        return;
      }
      toast.success(action === "approve"
        ? english ? "Work Packet created" : "Work Packet 已生成"
        : english ? "Owner review recorded" : "一把手复核结果已记录");
      setSelected(null);
      router.refresh();
    });
  }

  const pendingDecisions = decisions.filter((decision) => decision.status === "EVIDENCE_READY");
  return (
    <section data-testid="stage1-decision-queue" className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-5" aria-labelledby="stage1-decision-queue-title">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "CEO operating loop" : "一把手经营闭环"}</p>
            <h2 id="stage1-decision-queue-title" className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">{english ? "Evidence-ready decisions" : "等待拍板的经营决策"}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">{english ? "Facts, inference, unknowns and freshness remain visible. Approval creates one governed Work Packet; QoderWork may only propose a draft." : "事实、推断、未知和时效始终可见。批准只生成一个受治理的 Work Packet；QoderWork 只能提交草稿。"}</p>
          </div>
          <Badge variant={pendingDecisions.length > 0 ? "approval" : "neutral"}>{pendingDecisions.length} {english ? "pending" : "项待拍板"}</Badge>
        </div>
        {decisions.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {decisions.slice(0, 6).map((decision) => (
              <button data-testid="stage1-decision-card" key={decision.id} type="button" onClick={() => openDecision(decision)} className="group border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left transition hover:border-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                <div className="flex items-center justify-between gap-3"><Badge variant={decision.status === "EVIDENCE_READY" ? "approval" : "neutral"}>{decision.status}</Badge><ArrowRight className="size-4 text-[color:var(--muted-foreground)] transition group-hover:translate-x-0.5" aria-hidden="true" /></div>
                <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">{decision.businessQuestion}</p>
                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{english ? "Evidence" : "证据"} {decision.evidenceRefs.length} · {english ? "Confidence" : "置信度"} {decision.confidence} · {english ? "Risk" : "风险"} {decision.riskLevel}</p>
              </button>
            ))}
          </div>
        ) : <p className="mt-4 border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">{english ? "No governed decision records yet." : "尚无受治理的决策记录。"}</p>}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent closeLabel={english ? "Close decision drawer" : "关闭决策抽屉"}>
          {selected ? <>
            <SheetHeader>
              <SheetTitle>{selected.businessQuestion}</SheetTitle>
              <SheetDescription>{selected.decisionKey} · {selected.status} · {english ? "valid until" : "有效期至"} {selected.validUntil ? new Date(selected.validUntil).toLocaleString(english ? "en" : "zh-CN") : english ? "not set" : "未设置"}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-5 py-5">
              <DecisionSection title={english ? "Recommendation and alternatives" : "推荐与备选"} icon={ShieldCheck}>
                <p>{selected.recommendedOption ?? (english ? "No recommendation" : "暂无推荐")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted-foreground)]">{selected.alternatives.map((item) => <li key={item}>{item}</li>)}</ul>
              </DecisionSection>
              <DecisionSection title={english ? "Facts" : "事实"} icon={FileText}><StatementList items={selected.facts} empty={english ? "No facts" : "暂无事实"} /></DecisionSection>
              <DecisionSection title={english ? "Inference" : "推断"} icon={FileText}><StatementList items={selected.inferences} empty={english ? "No inference" : "暂无推断"} /></DecisionSection>
              <DecisionSection title={english ? "Unknowns and risks" : "未知与风险"} icon={AlertTriangle}>
                <RefList values={[...selected.unknowns.map((item) => `未知：${item}`), ...selected.risks.map((item) => `风险：${item}`)]} />
              </DecisionSection>
              <DecisionSection title={english ? "Governed references" : "治理引用"} icon={ShieldCheck}>
                <RefList values={[...selected.knowledgeRefs, ...selected.evidenceRefs, ...selected.policyRefs, ...selected.receiptRefs]} />
              </DecisionSection>
              {selected.qoderDrafts.length > 0 ? <DecisionSection title={english ? "QoderWork draft preview" : "QoderWork 跟进草稿预览"} icon={FileText}>
                {selected.qoderDrafts.map((draft) => <div key={draft.id} className="mt-2 border border-[color:var(--border)] p-3"><Badge variant="neutral">{draft.disposition}</Badge><p className="mt-2 whitespace-pre-wrap">{draft.summary}</p></div>)}
                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{english ? "Preview only. There is no send action on this surface." : "仅供预览；本页面不提供发送动作。"}</p>
              </DecisionSection> : null}

              {selected.status === "EVIDENCE_READY" ? <div className="space-y-4 border-t border-[color:var(--border)] pt-5">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Approve and create the unique Work Packet" : "批准并生成唯一 Work Packet"}</p>
                <Field label={english ? "Owner conclusion" : "一把手结论"}><Textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></Field>
                <Field label={english ? "Execution target" : "执行对象"}><Input value={executionTargetRef} onChange={(event) => setExecutionTargetRef(event.target.value)} /></Field>
                <Field label={english ? "Goal" : "目标"}><Textarea value={goal} onChange={(event) => setGoal(event.target.value)} /></Field>
                <Field label={english ? "Action" : "行动要求"}><Textarea value={workAction} onChange={(event) => setWorkAction(event.target.value)} /></Field>
                <Field label={english ? "Due at" : "截止时间"}><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>
                <Field label={english ? "Acceptance criteria, one per line" : "验收标准，每行一条"}><Textarea value={acceptanceCriteria} onChange={(event) => setAcceptanceCriteria(event.target.value)} /></Field>
                <Field label={english ? "Evidence requirements, one per line" : "回执证据要求，每行一条"}><Textarea value={evidenceRequirements} onChange={(event) => setEvidenceRequirements(event.target.value)} /></Field>
                <Field label={english ? "Invalidation conditions, one per line" : "失效条件，每行一条"}><Textarea value={invalidationConditions} onChange={(event) => setInvalidationConditions(event.target.value)} /></Field>
                <Field label={english ? "Escalation owner" : "升级责任人"}><Input value={escalationOwnerRef} onChange={(event) => setEscalationOwnerRef(event.target.value)} /></Field>
                <Button disabled={pending} onClick={() => void submit("approve")} className="w-full">{english ? "Approve and create Work Packet" : "批准并生成 Work Packet"}</Button>

                <div className="border-t border-[color:var(--border)] pt-4">
                  <Field label={english ? "Structured reason for reject, defer, or evidence request" : "拒绝、延后或补证的结构化原因"}><Textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} /></Field>
                  <Field label={english ? "Defer until" : "延后至"}><Input type="datetime-local" value={deferUntil} onChange={(event) => setDeferUntil(event.target.value)} /></Field>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button variant="danger" disabled={pending || reviewReason.trim().length < 3} onClick={() => void submit("reject")}>{english ? "Reject" : "拒绝"}</Button>
                    <Button variant="secondary" disabled={pending || reviewReason.trim().length < 3} onClick={() => void submit("defer")}>{english ? "Defer" : "延后"}</Button>
                    <Button variant="outline" disabled={pending || reviewReason.trim().length < 3} onClick={() => void submit("request_evidence")}>{english ? "Need evidence" : "要求补证"}</Button>
                  </div>
                </div>
              </div> : null}
              {selected.workPacket ? <div className="border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4"><p className="text-sm font-medium">{selected.workPacket.title}</p><p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Work Packet {selected.workPacket.id} · {selected.workPacket.status}</p></div> : null}
            </div>
          </> : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function DecisionSection({ title, icon: Icon, children }: { title: string; icon: typeof ShieldCheck; children: React.ReactNode }) {
  return <section><h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]"><Icon className="size-4" aria-hidden="true" />{title}</h3><div className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{children}</div></section>;
}

function StatementList({ items, empty }: { items: Array<{ statement: string; evidenceRefs: string[] }>; empty: string }) {
  if (items.length === 0) return <p className="text-[color:var(--muted-foreground)]">{empty}</p>;
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${item.statement}-${index}`}><p>{item.statement}</p><p className="font-mono text-xs text-[color:var(--muted-foreground)]">{item.evidenceRefs.join(" · ")}</p></li>)}</ul>;
}

function RefList({ values }: { values: string[] }) {
  return values.length > 0 ? <ul className="list-disc space-y-1 pl-5">{values.map((value, index) => <li key={`${value}-${index}`} className="break-all">{value}</li>)}</ul> : <p className="text-[color:var(--muted-foreground)]">—</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-[color:var(--muted-foreground)]"><span>{label}</span>{children}</label>;
}
