/**
 * Shell-experience seam（默认经营工作区重构蓝图 §3.3 的 Phase 0 落地）。
 *
 * 租户可在 workspace.configuration JSON 里声明 shellChromeProfiles，把指定
 * 路由子树的左侧导航栏隐藏（例如租户自含式 OS 子树），替代任何依赖 Core
 * shell DOM 结构的 overlay CSS 隐藏手段。
 *
 * 边界（刻意收窄的 Phase 0 语义）：
 * - 只支持 sidebar: "hidden"；Topbar 恒保留（字段形态给后续 chrome 维度留位）。
 * - 只作用于声明的子树前缀（segment 边界匹配），不提供全局隐藏：pathPrefix
 *   不接受 "/"。
 * - fail-closed 解析：非法条目逐条丢弃；任何解析/匹配异常一律回完整 Core
 *   chrome（失败方向永远是"恢复完整导航"，见蓝图 §3.3/§7.3）。
 * - 优先级链中 Core-owned route 声明通道本阶段未实现（预留，高于 workspace
 *   配置）；当前生效顺序：workspace 配置 → Core 默认（完整 chrome）。
 * - 这是展示层收敛，不是权限面：隐藏导航不影响任何页面的可达性与鉴权。
 */

export type ShellChromeProfile = {
  pathPrefix: string;
  sidebar: "hidden";
};

export type ShellChromeResolution = {
  sidebar: "visible" | "hidden";
  topbar: "visible";
};

const MAX_PROFILES = 20;
const MAX_PREFIX_LENGTH = 200;

export const FULL_SHELL_CHROME: ShellChromeResolution = {
  sidebar: "visible",
  topbar: "visible",
};

function isValidPathPrefix(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (path !== value) return false;
  if (path.length < 2 || path.length > MAX_PREFIX_LENGTH) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes(":") || path.includes("\\")) return false;
  if (path.includes("?") || path.includes("#") || path.includes("*")) return false;
  if (path.endsWith("/")) return false;
  return true;
}

/**
 * 从 workspace.configuration 原始 JSON 解析 shellChromeProfiles。
 * 非法输入（非 JSON、非数组、超额、非法条目）按 fail-closed 逐层丢弃。
 */
export function parseShellChromeProfiles(
  rawConfiguration: string | null | undefined,
): ShellChromeProfile[] {
  if (!rawConfiguration) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfiguration);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const raw = (parsed as { shellChromeProfiles?: unknown }).shellChromeProfiles;
  if (!Array.isArray(raw)) return [];
  const profiles: ShellChromeProfile[] = [];
  for (const entry of raw.slice(0, MAX_PROFILES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const candidate = entry as { pathPrefix?: unknown; sidebar?: unknown };
    if (candidate.sidebar !== "hidden") continue;
    if (!isValidPathPrefix(candidate.pathPrefix)) continue;
    profiles.push({ pathPrefix: candidate.pathPrefix, sidebar: "hidden" });
  }
  return profiles;
}

/**
 * 按 segment 边界做子树前缀匹配；任何异常回完整 chrome。
 */
export function resolveShellChrome(
  pathname: string | null | undefined,
  profiles: ReadonlyArray<ShellChromeProfile>,
): ShellChromeResolution {
  try {
    if (typeof pathname !== "string" || !pathname.startsWith("/")) {
      return FULL_SHELL_CHROME;
    }
    for (const profile of profiles) {
      if (profile.sidebar !== "hidden") continue;
      if (!isValidPathPrefix(profile.pathPrefix)) continue;
      if (
        pathname === profile.pathPrefix ||
        pathname.startsWith(`${profile.pathPrefix}/`)
      ) {
        return { sidebar: "hidden", topbar: "visible" };
      }
    }
    return FULL_SHELL_CHROME;
  } catch {
    return FULL_SHELL_CHROME;
  }
}
