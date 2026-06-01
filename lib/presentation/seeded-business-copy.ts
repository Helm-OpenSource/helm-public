const seededChineseBusinessReplacements: Array<[RegExp, string]> = [
  [/joint launch brief/gi, "联合发布摘要"],
  [/panel briefing/gi, "面试简报"],
  [/follow-up materials?/gi, "跟进材料"],
  [/follow-up material/gi, "跟进材料"],
  [/follow-up mater\.\.\./gi, "跟进材料..."],
  [/\bfollow-up\b/gi, "跟进"],
  [/\bmaterials?\b/gi, "材料"],
  [/合作 brief/gi, "合作摘要"],
  [/候选人 briefing/gi, "候选人简报"],
  [/会前 briefing/gi, "会前简报"],
  [/后续 briefing/gi, "后续简报"],
  [/\bbriefing\b/gi, "简报"],
  [/\bbrief\b/gi, "摘要"],
  [/\bchampion\b/gi, "支持人"],
  [/\bshortlist\b/gi, "候选名单"],
  [/\bfinalist\b/gi, "终面候选人"],
  [/\bADVANCING\b/g, "推进中"],
  [/joint launch/gi, "联合发布"],
  [/\blaunch\b/gi, "发布"],
  [/系统最近确认到的关键信号是/g, "最近确认的关键信号是"],
  [/系统最近还学到/g, "最近还学到"],
  [/按当前策略，这类动作可以在阈值内自动执行。/g, "按当前规则，这类动作会在条件内准备，并先保留复核。"],
  [/按当前策略/g, "按当前规则"],
];

const seededChineseBusinessCleanups: Array<[RegExp, string]> = [
  [/生成了 简报/g, "生成了简报"],
  [/发送 简报/g, "发送简报"],
  [/发送 摘要/g, "发送摘要"],
  [/合作 摘要/g, "合作摘要"],
  [/内部 支持人/g, "内部支持人"],
  [/发布 节点/g, "发布节点"],
  [/发布 素材/g, "发布素材"],
  [/跟进 材料/g, "跟进材料"],
  [/候选人 简报/g, "候选人简报"],
  [/面试 简报/g, "面试简报"],
  [/\s{2,}/g, " "],
];

export function formatSeededBusinessCopy(
  value: string | null | undefined,
  english: boolean,
) {
  const text = value ?? "";
  if (!text || english) return text;

  const formatted = seededChineseBusinessReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );

  return seededChineseBusinessCleanups
    .reduce(
      (current, [pattern, replacement]) =>
        current.replace(pattern, replacement),
      formatted,
    )
    .trim();
}
