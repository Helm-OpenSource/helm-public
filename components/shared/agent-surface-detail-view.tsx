import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  RoleConversationDetailShell,
  type RoleConversationDetailShellProps,
} from "@/components/shared/role-conversation-detail-shell";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";
import { trimText } from "@/lib/utils";

type AgentSurfaceHeaderAction = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost";
};

type AgentSurfaceDetailViewProps = Omit<RoleConversationDetailShellProps, "actions"> & {
  actions: AgentSurfaceHeaderAction[];
  wrapperDataAttributes?: Record<string, string | undefined>;
};

export function AgentSurfaceDetailView({
  actions,
  wrapperDataAttributes,
  ...shellProps
}: AgentSurfaceDetailViewProps) {
  const operatingSummaryItems =
    shellProps.operatingSummaryItems ?? buildDefaultOperatingSummaryItems(shellProps.english, shellProps.protocol);
  const text = (value: string) =>
    formatRoleDetailDisplayText(value, shellProps.english);

  return (
    <div {...wrapperDataAttributes}>
      <RoleConversationDetailShell
        {...shellProps}
        operatingSummaryItems={operatingSummaryItems}
        actions={
          <>
            {actions.map((action, index) => (
              <Button
                key={`${action.href}-${action.label}-${index}`}
                variant={action.variant}
                asChild
              >
                <Link href={action.href}>{text(action.label)}</Link>
              </Button>
            ))}
          </>
        }
      />
    </div>
  );
}

function buildDefaultOperatingSummaryItems(
  english: boolean,
  protocol: RoleConversationDetailShellProps["protocol"],
) {
  const currentFocus = trimText(
    protocol.pageActionSummary[0] ?? protocol.pageJudgementReason,
    110,
  );
  const nextStep = trimText(
    protocol.pageNextAction[0]?.label ?? protocol.pageDecisionRequest[0] ?? protocol.pageJudgement,
    96,
  );
  const boundary = trimText(
    protocol.pageBoundarySummary[0] ?? protocol.pageJudgementReason,
    110,
  );
  const sourceContext = trimText(
    protocol.pageEvidenceSummary[0] ?? protocol.pageWorkerSummary[0] ?? protocol.pageJudgementReason,
    110,
  );

  return [
    {
      label: english ? "Current focus" : "当前处理焦点",
      value: currentFocus,
    },
    {
      label: english ? "Single next step" : "最重要下一步",
      value: nextStep,
    },
    {
      label: english ? "Boundary posture" : "当前边界状态",
      value: boundary,
    },
    {
      label: english ? "Source context" : "支撑上下文",
      value: sourceContext,
    },
  ];
}
