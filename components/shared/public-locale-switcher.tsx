"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePublicLocaleAction } from "@/features/auth/actions";
import type { UiLocale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type PublicLocaleSwitcherProps = {
  className?: string;
  locale?: UiLocale;
  variant?: "default" | "compact";
  testId?: string;
};

export function PublicLocaleSwitcher({
  className,
  locale = "zh-CN",
  variant = "default",
  testId,
}: PublicLocaleSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchLocale = (value: UiLocale) => {
    startTransition(async () => {
      const result = await updatePublicLocaleAction(value);

      if (!result.ok) {
        return;
      }

      router.refresh();
    });
  };

  if (variant === "compact") {
    const english = locale === "en-US";

    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-card)]",
          className,
        )}
        data-testid={testId}
        role="group"
        aria-label={english ? "Language switch" : "语言切换"}
      >
        {(["zh-CN", "en-US"] as const).map((value) => {
          const selected = locale === value;

          return (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={selected ? "secondary" : "ghost"}
              className="h-8 rounded-full px-2.5 text-xs font-semibold"
              data-testid={testId ? `${testId}-${value}` : undefined}
              aria-pressed={selected}
              disabled={pending}
              aria-label={
                value === "zh-CN"
                  ? english
                    ? "Switch to Chinese"
                    : "切换到中文"
                  : english
                    ? "Switch to English"
                    : "切换到英文"
              }
              onClick={() => switchLocale(value)}
            >
              {value === "zh-CN" ? "中" : "EN"}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      <Select
        value={locale}
        disabled={pending}
        onValueChange={(value) => {
          switchLocale(value as UiLocale);
        }}
      >
        <SelectTrigger
          aria-label={locale === "en-US" ? "Switch language" : "切换语言"}
          className="h-9 min-w-[132px]"
        >
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            <SelectValue placeholder={locale === "en-US" ? "Language" : "界面语言"} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="zh-CN">{locale === "en-US" ? "Chinese" : "中文"}</SelectItem>
          <SelectItem value="en-US">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
