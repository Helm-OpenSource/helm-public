import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RoleConversationDetailShell } from "@/components/shared/role-conversation-detail-shell";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";
import type { ConversationChainExtensionPageModel } from "@/features/conversation-chain-extension/detail-model";

export function ConversationChainExtensionDetailView({
  model,
  english,
}: {
  model: ConversationChainExtensionPageModel;
  english: boolean;
}) {
  const text = (value: string) => formatRoleDetailDisplayText(value, english);

  return (
    <div
      data-conversation-chain-extension-page={
        model.rootDataAttributes["data-conversation-chain-extension-page"]
      }
      data-conversation-chain-extension-kind={
        model.rootDataAttributes["data-conversation-chain-extension-kind"]
      }
    >
      <RoleConversationDetailShell
        rootDataAttributes={model.rootDataAttributes}
        english={english}
        eyebrow={model.eyebrow}
        title={model.title}
        description={model.description}
        actions={
          <>
            {model.actions.map((action, index) => (
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
        briefingLabel={model.briefingLabel}
        navigation={model.navigation}
        protocol={model.protocol}
        chips={model.chips}
        secondarySummaryItems={model.secondarySummaryItems}
        boundaryLabel={model.boundaryLabel}
        actionLabel={model.actionLabel}
        evidenceLabel={model.evidenceLabel}
        evidenceCountLabel={model.evidenceCountLabel}
        evidenceGroups={model.evidenceGroups}
        stageBadge={model.stageBadge}
      />
    </div>
  );
}
