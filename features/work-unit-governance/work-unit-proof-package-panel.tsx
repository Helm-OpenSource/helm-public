import { ClipboardCheck, FileText, Link2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  WorkUnitProofEntry,
  WorkUnitProofPackageReadout,
} from "@/lib/work-unit-governance/proof-package";

type WorkUnitProofPackagePanelProps = {
  readonly readout: WorkUnitProofPackageReadout;
  readonly english: boolean;
};

function kindCopy(kind: WorkUnitProofEntry["kind"], english: boolean): string {
  const copy: Record<WorkUnitProofEntry["kind"], { readonly zh: string; readonly en: string }> = {
    work_unit_snapshot: { zh: "工作包快照", en: "Work package snapshot" },
    decision_card: { zh: "决策卡", en: "Decision card" },
    candidate_artifact: { zh: "候选方案", en: "Candidate artifact" },
    evidence_manifest: { zh: "证据清单", en: "Evidence manifest" },
    validation_receipt: { zh: "检查回执", en: "Check receipt" },
    owner_decision: { zh: "负责人决定", en: "Owner decision" },
    merge_receipt: { zh: "定稿回执", en: "Mainline receipt" },
    activation_handoff_request: { zh: "生效交接请求", en: "Activation handoff request" },
    activation_authority_receipt: { zh: "生效授权回执", en: "Activation authority receipt" },
    repair_candidate: { zh: "修复候选记录", en: "Repair candidate record" },
    learning_asset_draft: { zh: "经验资产草案", en: "Learning asset draft" },
  };
  return english ? copy[kind].en : copy[kind].zh;
}

function entryTitle(entry: WorkUnitProofEntry, english: boolean): string {
  return `${kindCopy(entry.kind, english)} · ${entry.title}`;
}

export function WorkUnitProofPackagePanel({
  readout,
  english,
}: WorkUnitProofPackagePanelProps) {
  const displayedEntries = readout.entries.slice(0, 6);

  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-proof-package-panel="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Proof package" : "证明包"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {english ? readout.userVisible.title.en : readout.userVisible.title.zh}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english ? readout.userVisible.summary.en : readout.userVisible.summary.zh}
          </p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Snapshot-bound evidence" : "快照绑定证据"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{english ? "Review material" : "审查材料"}</Badge>
          <Badge variant="neutral">{english ? "Not readiness" : "不是就绪"}</Badge>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <FileText className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Proof items" : "证据条目"}
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
            {readout.entryCount}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <ClipboardCheck className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Covered needs" : "已覆盖需求"}
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
            {readout.coveredRequirementCount}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Link2 className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Snapshot" : "快照"}
          </dt>
          <dd className="mt-2 break-all text-xs leading-5 text-[color:var(--muted-foreground)]">
            {readout.snapshotHash}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Evidence preview" : "证据预览"}
        </h3>
        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {displayedEntries.map((entry) => (
            <li key={entry.entryId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {entryTitle(entry, english)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {entry.summary}
                  </p>
                </div>
                <Badge variant="neutral">{entry.redactionStatus}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
        <p>{english ? readout.userVisible.boundary.en : readout.userVisible.boundary.zh}</p>
      </div>
    </section>
  );
}
