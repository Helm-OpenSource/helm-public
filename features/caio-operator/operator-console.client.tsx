"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import * as actions from "./actions";
import {
  CAIO_OPERATOR_GROUPS,
  CAIO_OPERATOR_OPERATIONS,
  type CaioOperatorOperation,
} from "./operator-operations";
import type { CaioOperatorResult, CaioOperationSummary } from "./run-owner-operation";

type OperatorAction = (rawInput: unknown) => Promise<CaioOperatorResult<CaioOperationSummary>>;

const ACTIONS: Readonly<Record<string, OperatorAction>> = {
  registerPrincipalBinding: actions.registerPrincipalBindingAction,
  revokePrincipalBinding: actions.revokePrincipalBindingAction,
  createMandateDraft: actions.createMandateDraftAction,
  activateMandate: actions.activateMandateAction,
  suspendMandate: actions.suspendMandateAction,
  revokeMandate: actions.revokeMandateAction,
  recordGuardianStop: actions.recordGuardianStopAction,
  resumeGuardianStop: actions.resumeGuardianStopAction,
  createCatalogEntry: actions.createCatalogEntryAction,
  recordCatalogClassification: actions.recordCatalogClassificationAction,
  recordCatalogAuthorization: actions.recordCatalogAuthorizationAction,
  recordCatalogConnection: actions.recordCatalogConnectionAction,
  recordCatalogInitialization: actions.recordCatalogInitializationAction,
  createObservationProgram: actions.createObservationProgramAction,
  registerObservationSource: actions.registerObservationSourceAction,
  recordInitializationAssessment: actions.recordInitializationAssessmentAction,
  acceptInitializationGate: actions.acceptInitializationGateAction,
  revokeInitializationGate: actions.revokeInitializationGateAction,
};

const ACTOR_LABEL = {
  owner: { zh: "所有者登记", en: "Owner registration" },
  ceo: { zh: "CEO 行为（按身份绑定校验）", en: "CEO act (checked against the binding)" },
  guardian: { zh: "guardian 行为（按身份绑定校验）", en: "Guardian act (checked against the binding)" },
} as const;

function OperationCard({ operation, english }: { operation: CaioOperatorOperation; english: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => JSON.stringify(operation.template, null, 2));
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setOutcome({ ok: false, text: english ? "The input is not valid JSON." : "输入不是合法 JSON。" });
      return;
    }
    const action = ACTIONS[operation.key];
    startTransition(async () => {
      const result = await action(parsed);
      if (result.ok) {
        const summary = Object.entries(result.value).map(([key, value]) => `${key}=${String(value)}`).join(" ");
        setOutcome({ ok: true, text: `${english ? "Recorded" : "已记录"}${summary ? `：${summary}` : ""}` });
        router.refresh();
      } else {
        setOutcome({ ok: false, text: `${result.message}（${result.code}）` });
      }
    });
  }

  const titleId = `caio-operator-${operation.key}`;
  return (
    <form
      onSubmit={submit}
      aria-labelledby={titleId}
      className="space-y-3 border-t border-[color:var(--border)] py-4"
      data-caio-operator-operation={operation.key}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? operation.title.en : operation.title.zh}
        </h3>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {english ? ACTOR_LABEL[operation.actor].en : ACTOR_LABEL[operation.actor].zh}
        </span>
      </div>
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={Math.min(18, draft.split("\n").length)}
        spellCheck={false}
        className="font-mono text-xs"
        aria-label={english ? "Operation input (JSON)" : "操作输入（JSON）"}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (english ? "Submitting…" : "提交中…") : english ? "Submit" : "提交"}
        </Button>
        {outcome ? (
          <p
            role="status"
            className={outcome.ok ? "text-sm text-[color:var(--foreground)]" : "text-sm text-[color:var(--danger)]"}
          >
            {outcome.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function OperatorConsole({ english }: { english: boolean }) {
  return (
    <div className="space-y-8" data-caio-operator-console="true">
      {CAIO_OPERATOR_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`caio-operator-group-${group.key}`}>
          <h2 id={`caio-operator-group-${group.key}`} className="text-base font-semibold text-[color:var(--foreground)]">
            {english ? group.title.en : group.title.zh}
          </h2>
          {CAIO_OPERATOR_OPERATIONS.filter((operation) => operation.group === group.key).map((operation) => (
            <OperationCard key={operation.key} operation={operation} english={english} />
          ))}
        </section>
      ))}
    </div>
  );
}
