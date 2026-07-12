"use client";

import { usePathname } from "next/navigation";
import {
  resolveShellChrome,
  type ShellChromeProfile,
} from "@/lib/shell/shell-chrome";

/**
 * Shell chrome 子树门（shell-experience seam 的渲染端）：按当前 pathname 与
 * workspace 声明的 shellChromeProfiles 决定是否渲染 children（sidebar）。
 * 失败语义恒为恢复完整 chrome——解析异常、非法 profile、pathname 缺失时都
 * 渲染 children。只影响展示，不承担任何权限语义。
 */
export function ShellChromeGate({
  profiles,
  children,
}: {
  profiles: ReadonlyArray<ShellChromeProfile>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (profiles.length === 0) return <>{children}</>;
  const resolution = resolveShellChrome(pathname, profiles);
  if (resolution.sidebar === "hidden") return null;
  return <>{children}</>;
}
