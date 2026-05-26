const CHINESE_ANALYTICS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/conversation capture/gi, "现场采集"],
  [/internal operating role surface/gi, "内部运营角色页"],
  [/meeting briefing/gi, "会议简报"],
  [/review request detail/gi, "复核请求详情"],
  [/review requests?/gi, "复核请求"],
  [/success checks?/gi, "成功复盘"],
  [/expansion review detail/gi, "扩展复盘详情"],
  [/expansion review/gi, "扩展复盘"],
  [/review-before-send/gi, "发送前复核"],
  [/formal review/gi, "正式复核"],
  [/customer-facing/gi, "面向客户"],
  [/customer-visible/gi, "客户可见"],
  [/customer success/gi, "客户成功"],
  [/email thread/gi, "邮件会话"],
  [/meeting notes?/gi, "会议纪要"],
  [/today focus/gi, "今日重点"],
  [/follow-through/gi, "后续动作"],
  [/gpt[\s-]*4[\s-]*1[\s-]*mini/gi, "默认模型"],
  [/\bopenai\b/gi, "智能服务"],
  [/\bgpt\b/gi, "通用模型"],
  [/\bjson\b/gi, "结构化输出"],
  [/\bllm\b/gi, "智能服务"],
  [/\basr\b/gi, "转写"],
  [/\bpilot\b/gi, "试点"],
  [/\bcaptures\b/gi, "采集"],
  [/\bcapture\b/gi, "采集"],
  [/\btranscripts\b/gi, "转写文本"],
  [/\btranscript\b/gi, "转写文本"],
  [/\bproviders\b/gi, "服务来源"],
  [/\bprovider\b/gi, "服务来源"],
  [/\breasoning\b/gi, "推理"],
  [/\bexplanations\b/gi, "解释"],
  [/\bexplanation\b/gi, "解释"],
  [/\brecommendations\b/gi, "判断建议"],
  [/\brecommendation\b/gi, "判断建议"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bblocker\b/gi, "阻塞"],
  [/\bcommitments\b/gi, "承诺"],
  [/\bcommitment\b/gi, "承诺"],
  [/\bworkflow\b/gi, "工作回路"],
  [/\btelemetry\b/gi, "使用信号"],
  [/\bprompt\b/gi, "提示词"],
  [/\bqueue\b/gi, "待处理队列"],
  [/\bhandoff\b/gi, "交接"],
  [/\bworker\b/gi, "协作者"],
  [/\bskill\b/gi, "能力"],
  [/\boperator\b/gi, "操作人"],
  [/\bsource\b/gi, "来源"],
  [/\bmemory\b/gi, "记忆"],
  [/\bobject\b/gi, "对象"],
  [/\bcontact\b/gi, "联系人"],
  [/\bcompany\b/gi, "公司"],
  [/\binbox\b/gi, "收件箱"],
  [/\bemail\b/gi, "邮件"],
  [/\bthread\b/gi, "会话"],
  [/\bauth\b/gi, "认证"],
  [/\btimeline\b/gi, "时间线"],
  [/page view/gi, "页面访问"],
  [/\bworkspace\b/gi, "工作区"],
  [/\bpage\b/gi, "页面"],
  [/\buser\b/gi, "用户"],
  [/\bactions\b/gi, "动作"],
  [/\baction\b/gi, "动作"],
  [/\bcreated\b/gi, "已创建"],
  [/\bgenerated\b/gi, "已生成"],
  [/\bopened\b/gi, "已打开"],
  [/\bviewed\b/gi, "已查看"],
  [/\bview\b/gi, "查看"],
  [/\bdisabled\b/gi, "已关闭"],
  [/\bflow\b/gi, "流转"],
  [/\breplay\b/gi, "回放"],
  [/\bdetail\b/gi, "详情"],
  [/\bproposal\b/gi, "方案"],
  [/\bpackage\b/gi, "打包方案"],
  [/\bpipeline\b/gi, "推进管线"],
  [/\bbriefing\b/gi, "简报"],
  [/模型 被关闭/g, "模型已关闭"],
  [/智能服务 被关闭/g, "智能服务已关闭"],
];

export function formatAnalyticsVisibleText(
  value: string | null | undefined,
  english: boolean,
) {
  if (!value) return "";
  if (english) return value;

  return CHINESE_ANALYTICS_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

export function formatAnalyticsTechnicalKey(
  value: string | null | undefined,
  english: boolean,
) {
  if (!value) return "";
  if (english) return value;

  const readable = value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return formatAnalyticsVisibleText(readable, english);
}
