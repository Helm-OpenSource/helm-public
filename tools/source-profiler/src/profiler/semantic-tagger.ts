/**
 * Source Profiler — deterministic semantic tagger.
 *
 * Maps a field name + normalized data type to semantic tags using bilingual
 * (zh/en) token rules. Deterministic and side-effect free. These tags feed the
 * mapping proposer; they are a starting vocabulary aligned with
 * `lib/connectors/signal-classification.ts`.
 */

type TagRule = { tag: string; tokens: RegExp };

const TAG_RULES: readonly TagRule[] = [
  { tag: "email", tokens: /(e?mail|邮箱|邮件)/i },
  { tag: "phone", tokens: /(phone|mobile|\btel\b|手机|电话)/i },
  { tag: "amount", tokens: /(amount|price|total|revenue|\bsum\b|金额|价格|总额|收入)/i },
  { tag: "stage", tokens: /(stage|status|phase|阶段|状态)/i },
  { tag: "name", tokens: /(name|title|名称|姓名|标题)/i },
  { tag: "domain", tokens: /(domain|website|\burl\b|网址|域名|官网)/i },
  { tag: "owner_ref", tokens: /(owner|assignee|responsible|负责人|owner_id|_by$)/i },
  { tag: "company_ref", tokens: /(company|account|customer|客户|公司)/i },
  { tag: "contact_ref", tokens: /(contact|person|联系人)/i },
  { tag: "opportunity_ref", tokens: /(opportunity|deal|商机|机会)/i },
  { tag: "meeting_ref", tokens: /(meeting|event|会议|会面)/i },
  { tag: "due_date", tokens: /(due|deadline|expire|截止|到期)/i },
  { tag: "date", tokens: /(date|time|_at$|时间|日期)/i },
];

/**
 * Returns semantic tags for a field. `dataType` is the normalized type
 * (see normalizeDataType) and influences temporal/fk tagging.
 */
export function tagField(name: string, dataType: string): string[] {
  const tags = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.tokens.test(name)) tags.add(rule.tag);
  }
  if (dataType === "timestamp" || dataType === "date") tags.add("date");
  if (dataType === "fk" || /_id$/i.test(name) || /\bid\b/i.test(name)) {
    if (/^id$/i.test(name)) tags.add("primary_key");
    else tags.add("fk");
  }
  return [...tags];
}

/** Normalize a raw SQL/ORM/JSON type string into a small stable vocabulary. */
export function normalizeDataType(raw: string): string {
  const t = raw.toLowerCase().trim();
  if (/(timestamp|datetime)/.test(t)) return "timestamp";
  if (/\bdate\b/.test(t)) return "date";
  if (/(decimal|numeric|money|float|double|real)/.test(t)) return "decimal";
  if (/(int|serial|bigint|smallint|number)/.test(t)) return "int";
  if (/(bool)/.test(t)) return "bool";
  if (/(json|jsonb)/.test(t)) return "json";
  if (/(enum)/.test(t)) return "enum";
  if (/(uuid|guid)/.test(t)) return "string";
  if (/(text|char|varchar|string|clob)/.test(t)) return "string";
  return "unknown";
}
