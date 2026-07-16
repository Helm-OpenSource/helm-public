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
 * - fail-closed 解析为 all-or-nothing：声明存在任一非法条目（或整体超限）
 *   时整组失效，回完整 Core chrome——非法配置不部分生效（蓝图 §3.3 严格
 *   失败语义）。任何解析/匹配异常同样回完整 chrome。
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
// configuration 是共享 JSON 字段；解析前先限总长，防止误配超大文本拖慢每次
// layout 请求。超限视为非法配置 → 整组失效。
const MAX_RAW_CONFIGURATION_LENGTH = 20_000;
const MAX_BRAND_LABEL_LENGTH = 40;

/**
 * 从 workspace.configuration 解析租户品牌行覆盖(shell 左上角/移动端抽屉标题的
 * `messages.shell.brand` 文案)。展示层白标,与 shellChromeProfiles 同一配置载体。
 * fail-closed:未声明 / 非 string / 空白 / 超长(>40) / 含换行 → null(回默认品牌)。
 */
export function parseShellBrandLabel(
  rawConfiguration: string | null | undefined,
): string | null {
  if (typeof rawConfiguration !== "string" || rawConfiguration.length === 0) {
    return null;
  }
  if (rawConfiguration.length > MAX_RAW_CONFIGURATION_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfiguration);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const raw = (parsed as { shellBrandLabel?: unknown }).shellBrandLabel;
  if (typeof raw !== "string") return null;
  const label = raw.trim();
  if (label.length === 0 || label.length > MAX_BRAND_LABEL_LENGTH) return null;
  if (/[\r\n]/.test(label)) return null;
  return label;
}

export const FULL_SHELL_CHROME: ShellChromeResolution = Object.freeze({
  sidebar: "visible",
  topbar: "visible",
});

// canonical segment allowlist：只接受未编码的常规路径字符，显式排除
// 百分号编码、控制字符、".."/"." 段与空段，避免与 Next URL 归一化语义漂移。
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._~-]+$/;

function isValidPathPrefix(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 2 || value.length > MAX_PREFIX_LENGTH) return false;
  if (!value.startsWith("/")) return false;
  const segments = value.slice(1).split("/");
  for (const segment of segments) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) return false;
    if (segment === "." || segment === "..") return false;
    if (segment.includes("%")) return false;
  }
  return true;
}

/**
 * 从 workspace.configuration 原始 JSON 解析 shellChromeProfiles。
 * all-or-nothing：未声明 → []；声明非法（非数组、超限、任一条目非法）→ []。
 */
export function parseShellChromeProfiles(
  rawConfiguration: string | null | undefined,
): ShellChromeProfile[] {
  if (typeof rawConfiguration !== "string" || rawConfiguration.length === 0) {
    return [];
  }
  if (rawConfiguration.length > MAX_RAW_CONFIGURATION_LENGTH) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfiguration);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const raw = (parsed as { shellChromeProfiles?: unknown }).shellChromeProfiles;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_PROFILES) return [];
  const profiles: ShellChromeProfile[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const candidate = entry as { pathPrefix?: unknown; sidebar?: unknown };
    if (candidate.sidebar !== "hidden") return [];
    if (!isValidPathPrefix(candidate.pathPrefix)) return [];
    profiles.push({ pathPrefix: candidate.pathPrefix, sidebar: "hidden" });
  }
  return profiles;
}

/**
 * 按 segment 边界做子树前缀匹配（大小写敏感、精确字符匹配）；
 * 任何异常回完整 chrome。
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
