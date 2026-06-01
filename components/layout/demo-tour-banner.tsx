"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Sparkles, X } from "lucide-react";
import {
  demoQuickPathMatchesLocation,
  getDemoModeProfile,
} from "@/lib/demo/demo-modes";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "helm-demo-guide-dismissed";

export function DemoTourBanner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const [dismissed, setDismissed] = useState(true); // 默认关闭，减少烦扰
  const profile = demoMode ? getDemoModeProfile(demoMode, locale) : null;
  const quickPath = profile?.quickPath ?? [];
  const currentStepIndex = quickPath.findIndex(
    (item) => demoQuickPathMatchesLocation(item.href, pathname, searchParams),
  );
  const currentStep = currentStepIndex >= 0 ? quickPath[currentStepIndex] : null;
  const suggestedStep =
    currentStepIndex >= 0
      ? quickPath[currentStepIndex + 1] ?? null
      : quickPath[0] ?? null;

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // 检查用户是否永久关闭了引导
    const permanentlyDismissed = window.localStorage.getItem(STORAGE_KEY + "-permanent");
    const frame = window.requestAnimationFrame(() => {
      setDismissed(stored === "true" || permanentlyDismissed === "true");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  // 默认隐藏，只在Demo模式下且用户未关闭时显示
  if (dismissed || !profile || !demoMode) return null;

  return (
    <Card className="overflow-hidden border-[color:var(--mode-card-border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-[var(--mode-card-shadow)]">
      <CardContent className="space-y-3 py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral" className="demo-mode-badge">
                {english ? "Demo guide" : "演示引导"}
              </Badge>
              {suggestedStep ? (
                <Badge variant="neutral" className="demo-mode-badge">
                  {english ? "Suggested step" : "当前建议"}：{suggestedStep.label}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold tracking-tight text-[color:var(--foreground)]">{profile.title}</p>
              <p className="max-w-4xl text-sm leading-6 text-[color:var(--muted)]">{profile.conversionPrompt}</p>
              {currentStep ? (
                <div className="flex flex-wrap items-center gap-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  <span>{english ? "Current step" : "当前所在"}：</span>
                  <Link
                    href={currentStep.href}
                    className="font-medium text-[color:var(--muted)] underline decoration-[color:var(--border-strong)] underline-offset-2 transition hover:text-[color:var(--foreground)]"
                  >
                    {currentStep.label}
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestedStep ? (
                <Button
                  asChild
                  size="sm"
                  className="theme-primary-action"
                >
                  <Link href={suggestedStep.href}>
                    <Compass className="h-4 w-4" />
                    {suggestedStep.label}
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="secondary">
                <Link href="/demo">{english ? "Back to demo entry" : "返回演示入口"}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="demo-mode-link hover:bg-[color:var(--surface-subtle)]">
                <Link href="/setup">
                  <Sparkles className="h-4 w-4" />
                  {english ? "Start trial setup" : "开始试点初始化"}
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]"
              onClick={() => {
                window.localStorage.setItem(STORAGE_KEY + "-permanent", "true");
                setDismissed(true);
              }}
            >
              <X className="h-4 w-4" />
              {english ? "Never show again" : "永久不再显示"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]"
              onClick={() => {
                window.localStorage.setItem(STORAGE_KEY, "true");
                setDismissed(true);
              }}
            >
              {english ? "Hide for now" : "暂时隐藏"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
