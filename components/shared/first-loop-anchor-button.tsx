"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveFirstLoopReturnAnchorAction } from "@/features/first-loop/actions";
import type { WorkspaceFirstLoopItem } from "@/lib/operating-system/first-loop";

export function FirstLoopAnchorButton({
  anchor,
  english,
  hasExplicitAnchor,
}: {
  anchor: WorkspaceFirstLoopItem;
  english: boolean;
  hasExplicitAnchor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await saveFirstLoopReturnAnchorAction({
            href: anchor.href,
            label: anchor.label,
            summary: anchor.summary,
            sourcePage: pathname || "/dashboard",
          });

          if (!result.ok) {
            toast.error(
              result.error ??
                (english
                  ? "Failed to save the return anchor"
                  : "保存回访点失败"),
            );
            return;
          }

          toast.success(
            hasExplicitAnchor
              ? english
                ? "Return anchor updated"
                : "回访点已更新"
              : english
                ? "Return anchor saved"
                : "回访点已保存",
          );
          router.refresh();
        });
      }}
    >
      <BookmarkCheck className="h-4 w-4" />
      {hasExplicitAnchor
        ? english
          ? "Update return anchor"
          : "更新回访点"
        : english
          ? "Save return anchor"
          : "保存回访点"}
    </Button>
  );
}
