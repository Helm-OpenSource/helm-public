"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateWorkspaceOperationalControlsAction } from "@/features/settings/actions";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";

type LocaleSwitcherProps = {
  className?: string;
  iconOnly?: boolean;
};

export function LocaleSwitcher({ className, iconOnly }: LocaleSwitcherProps) {
  const router = useRouter();
  const { locale, messages, featureFlags, pilotMode, captureConsentRequired, dataRetentionDays } = useWorkspaceUi();
  const [pending, startTransition] = useTransition();

  if (!featureFlags.multilingualUi) {
    return null;
  }

  return (
    <div className={className}>
      <Select
        value={locale}
        disabled={pending}
        onValueChange={(value) => {
          startTransition(async () => {
            const result = await updateWorkspaceOperationalControlsAction({
              defaultLocale: value === "en-US" ? "en-US" : "zh-CN",
              pilotMode,
              captureConsentRequired,
              dataRetentionDays,
              featureFlags,
            });
            if (!result.ok) {
              toast.error(result.error ?? (locale === "en-US" ? "Failed to switch UI language" : "语言切换失败"));
              return;
            }
            router.refresh();
            toast.success(value === "en-US" ? "UI switched to English" : "界面已切换为中文");
          });
        }}
      >
        <SelectTrigger
          aria-label={locale === "en-US" ? "Switch language" : "切换语言"}
          title={locale === "en-US" ? "Switch language" : "切换语言"}
          className={
            iconOnly
              ? "h-9 w-9 justify-center px-0 [&>svg:last-child]:hidden"
              : "h-9 min-w-[132px]"
          }
        >
          {iconOnly ? (
            <Languages className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              <SelectValue placeholder={messages.shell.localeLabel} />
            </div>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="zh-CN">{locale === "en-US" ? "Chinese" : "中文"}</SelectItem>
          <SelectItem value="en-US">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
