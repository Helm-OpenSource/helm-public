import { BookOpen, Inbox, ShieldAlert, Target, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type EmptyStatePresetTone = "judgement" | "review" | "memory" | "neutral";

type PresetCopy = {
  icon: LucideIcon;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
};

const PRESETS: Record<EmptyStatePresetTone, PresetCopy> = {
  judgement: {
    icon: Target,
    titleZh: "今天没有需要你拍板的事",
    titleEn: "Nothing today needs your call",
    descZh: "这本身是一个判断 — 继续推进，新事项出现时会回到这里。",
    descEn: "That itself is a judgement. Keep moving — new items will return here.",
  },
  review: {
    icon: ShieldAlert,
    titleZh: "复核队列已清",
    titleEn: "Review queue is clear",
    descZh: "新的边界敏感工作出现时会回到这里。",
    descEn: "Boundary-sensitive work will reappear here.",
  },
  memory: {
    icon: BookOpen,
    titleZh: "记忆层暂时为空",
    titleEn: "Memory layer is empty for now",
    descZh: "随着事实、承诺和阻塞累积，下一轮判断会越来越基于上下文。",
    descEn:
      "As facts, commitments and blockers accumulate, future judgement gets more contextual.",
  },
  neutral: {
    icon: Inbox,
    titleZh: "暂无内容",
    titleEn: "Nothing here yet",
    descZh: "新内容出现时会显示在这里。",
    descEn: "New content will show up here as it arrives.",
  },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  presetTone,
  english = false,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
  };
  presetTone?: EmptyStatePresetTone;
  english?: boolean;
}) {
  const preset = presetTone ? PRESETS[presetTone] : null;
  const ResolvedIcon = icon ?? preset?.icon ?? Inbox;
  const resolvedTitle =
    title ?? (preset ? (english ? preset.titleEn : preset.titleZh) : "");
  const resolvedDescription =
    description ?? (preset ? (english ? preset.descEn : preset.descZh) : "");

  return (
    <Card className="workspace-panel-muted border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="rounded-[22px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
          <ResolvedIcon className="h-6 w-6 text-[color:var(--muted-foreground)]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">
            {resolvedTitle}
          </h3>
          <p className="max-w-md text-sm leading-7 text-[color:var(--muted-foreground)]">
            {resolvedDescription}
          </p>
        </div>
        {action ? (
          <Button variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
