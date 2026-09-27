import { PageHeader } from "@/components/shared/page-header";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { listWorkPacketsAssignedToMember } from "@/lib/stage1-owner-loop/member-work-packet-queries.service";

// Work the owner dispatched to the signed-in member. Visibility is the owner command's explicit executor
// grant; another member sees nothing of it here. Read-only: status changes go through the existing approval
// and execution-receipt chain, not this page.
export default async function CaioMyWorkPage() {
  const session = await getCurrentWorkspaceSession();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: session.workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const packets = await listWorkPacketsAssignedToMember({
    workspaceId: session.workspace.id,
    userId: session.user.id,
  });

  return (
    <div className="space-y-6" data-source-page="/caio/my-work">
      <PageHeader
        english={english}
        eyebrow={english ? "Assigned by the owner" : "一把手指派"}
        title={english ? "My CAIO work" : "我的 CAIO 任务"}
        description={
          english
            ? "Work packets the owner confirmed and dispatched to you. Nothing here executes by itself."
            : "一把手确认并派给你的工作包。本页只读，不会自动执行任何动作。"
        }
      />
      {packets.length === 0 ? (
        <p className="text-sm text-[color:var(--text-muted)]" data-testid="caio-my-work-empty">
          {english ? "No work has been dispatched to you." : "目前没有派给你的任务。"}
        </p>
      ) : (
        <ul className="space-y-4" data-testid="caio-my-work-list">
          {packets.map((packet) => (
            <li
              key={packet.actionItemRef}
              className="border border-[color:var(--border)] px-4 py-3"
              data-action-item-ref={packet.actionItemRef}
            >
              <p className="font-medium">{packet.title}</p>
              <p className="text-sm">{packet.goal}</p>
              <p className="text-sm">{packet.action}</p>
              <p className="text-xs text-[color:var(--text-muted)]">
                {english ? "Status" : "状态"}: {packet.status} · {english ? "Due" : "截止"}: {packet.dueAt}
              </p>
              <ul className="list-disc pl-5 text-xs">
                {packet.acceptanceCriteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
