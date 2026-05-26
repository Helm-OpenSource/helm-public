/**
 * lib/demo/industry-fixtures
 *
 * 跨行业 demo fixture pack 聚合入口。每个行业一份独立 .ts 文件 export
 * IndustryDemoPack；本文件做集中注册 + 行业列表 helper。
 *
 * 当前阶段（PR-06a）：仅 b2b-saas 一个行业落地。后续 PR-06b 加 5 个
 * 新行业（si-delivery / cross-border-ecommerce / customer-success /
 * operations / user-research），让用户进 demo 时能从 6 个行业选自己。
 */

import { B2B_SAAS_PACK } from "./b2b-saas";
import { CROSS_BORDER_ECOMMERCE_PACK } from "./cross-border-ecommerce";
import { CUSTOMER_SUCCESS_PACK } from "./customer-success";
import { OPERATIONS_PACK } from "./operations";
import { SI_DELIVERY_PACK } from "./si-delivery";
import { USER_RESEARCH_PACK } from "./user-research";
import type { IndustryDemoPack } from "./types";
import { listExtensionIndustryDemoPacks } from "@/lib/extensions/registry";

export type { IndustryDemoPack, IndustryJudgementCard } from "./types";

/**
 * 集中注册所有可用行业。新增行业时在此加一行 import + 一项 entry。
 */
const INDUSTRY_PACKS: ReadonlyArray<IndustryDemoPack> = [
  B2B_SAAS_PACK,
  CUSTOMER_SUCCESS_PACK,
  OPERATIONS_PACK,
  SI_DELIVERY_PACK,
  CROSS_BORDER_ECOMMERCE_PACK,
  USER_RESEARCH_PACK,
  ...listExtensionIndustryDemoPacks(),
];

const INDUSTRY_PACK_BY_KEY: ReadonlyMap<string, IndustryDemoPack> = new Map(
  INDUSTRY_PACKS.map((pack) => [pack.industryKey, pack]),
);

/**
 * 列出所有可用行业的 displayName 摘要（demo 入口选择器用）。
 */
export function listIndustryPacks(): ReadonlyArray<IndustryDemoPack> {
  return INDUSTRY_PACKS;
}

/**
 * 按 industryKey 拿单个行业 pack；不存在返回 null。
 */
export function getIndustryPack(industryKey: string): IndustryDemoPack | null {
  return INDUSTRY_PACK_BY_KEY.get(industryKey) ?? null;
}
