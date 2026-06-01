import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export default async function WorkspaceNotFound() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-xl">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-3xl bg-[color:color-mix(in_oklab,var(--surface-subtle)_86%,var(--background)_14%)] p-4">
            <SearchX className="h-8 w-8 text-[color:var(--muted-foreground)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">{english ? "We could not find this item" : "没有找到对应内容"}</h1>
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "The object may have been deleted, archived, or is outside the current workspace permission boundary."
                : "这个对象可能已经被删除、归档，或者当前工作区没有访问权限。"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">{english ? "Back to dashboard" : "返回今日工作台"}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/search">{english ? "Go to search" : "去全局搜索"}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
