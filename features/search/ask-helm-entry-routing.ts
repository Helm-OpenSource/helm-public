const ASK_HELM_ENTRY_PATTERNS = [
  /[?？]/u,
  /\b(what|why|how|who|which|where|next|today|blocker|blocked|review|draft|follow[- ]?up|priority|priorities)\b/iu,
  /(什么|为什么|怎么|如何|谁|哪个|哪些|哪里|下一步|优先|重点|阻塞|推进|复核|审批|草稿|跟进|安排|处理)/u,
];

const OBJECT_LOOKUP_PATTERNS = [
  /^[\w.@+-]+$/u,
  /^[\p{Script=Han}A-Za-z0-9·（）()\s-]{1,18}$/u,
];

export function shouldRouteSearchQueryToAskHelm(query: string) {
  const normalized = query.trim();
  if (!normalized) return false;

  if (
    OBJECT_LOOKUP_PATTERNS.some((pattern) => pattern.test(normalized)) &&
    !ASK_HELM_ENTRY_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return false;
  }

  return ASK_HELM_ENTRY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildSearchIntentHref(query: string) {
  const normalized = query.trim();
  if (!normalized) return "/search";

  const params = new URLSearchParams({ q: normalized });
  if (shouldRouteSearchQueryToAskHelm(normalized)) {
    params.set("mode", "ask");
  }

  return `/search?${params.toString()}`;
}

export function buildAskHelmHref(query: string) {
  const normalized = query.trim();
  if (!normalized) return "/search?mode=ask";

  return `/search?mode=ask&q=${encodeURIComponent(normalized)}`;
}
