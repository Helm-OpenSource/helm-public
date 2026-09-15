import { CaioMandateStoreError } from "@/lib/caio-governance/mandate-store.service";
import { CaioInitializationGateStoreError } from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";
import {
  DataAssetCatalogConflictError,
  DataAssetCatalogContractError,
  DataAssetCatalogTransitionError,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import {
  ObservationAuthorizationDeniedError,
  ObservationContractError,
} from "@/lib/stage1-owner-loop/observation.service";

/**
 * Closed error codes for the CAIO OWNER operator entry points. Service messages and
 * reasons can carry internal detail, so callers only ever see a code and its fixed copy.
 */
export const CAIO_OPERATOR_ERROR_CODES = [
  "not_owner",
  "input_invalid",
  "governance_rejected",
  "initialization_rejected",
  "catalog_rejected",
  "catalog_conflict",
  "observation_rejected",
  "observation_denied",
  "unavailable",
] as const;

export type CaioOperatorErrorCode = (typeof CAIO_OPERATOR_ERROR_CODES)[number];

export function mapCaioOperatorError(error: unknown): CaioOperatorErrorCode {
  if (error instanceof CaioMandateStoreError) return "governance_rejected";
  if (error instanceof CaioInitializationGateStoreError) return "initialization_rejected";
  // Conflict before contract/transition: a conflict is retryable state, not an invalid request.
  if (error instanceof DataAssetCatalogConflictError) return "catalog_conflict";
  if (error instanceof DataAssetCatalogContractError || error instanceof DataAssetCatalogTransitionError) {
    return "catalog_rejected";
  }
  if (error instanceof ObservationAuthorizationDeniedError) return "observation_denied";
  if (error instanceof ObservationContractError) return "observation_rejected";
  return "unavailable";
}

const MESSAGES: Readonly<Record<CaioOperatorErrorCode, { zh: string; en: string }>> = {
  not_owner: {
    zh: "仅工作区所有者可执行此操作。",
    en: "Only the workspace owner can perform this operation.",
  },
  input_invalid: {
    zh: "输入不完整或格式不正确，请检查后重试。",
    en: "The input is incomplete or malformed. Check it and try again.",
  },
  governance_rejected: {
    zh: "治理规则拒绝了此操作（身份绑定、授权任命或急停状态不满足）。",
    en: "Governance rules rejected this operation (binding, mandate, or stop state not satisfied).",
  },
  initialization_rejected: {
    zh: "初始化验收门拒绝了此操作（评估、受理条件或当前状态不满足）。",
    en: "The initialization gate rejected this operation (assessment, acceptance, or current state not satisfied).",
  },
  catalog_rejected: {
    zh: "数据资产目录拒绝了此操作（字段或阶段顺序不满足）。",
    en: "The data asset catalog rejected this operation (fields or stage order not satisfied).",
  },
  catalog_conflict: {
    zh: "数据资产目录已被其它操作更新，请刷新后重试。",
    en: "The data asset catalog changed concurrently. Refresh and try again.",
  },
  observation_rejected: {
    zh: "观察来源登记被拒绝（字段或约束不满足）。",
    en: "The observation registration was rejected (fields or constraints not satisfied).",
  },
  observation_denied: {
    zh: "观察授权不足，未登记。",
    en: "Observation authorization is insufficient; nothing was registered.",
  },
  unavailable: {
    zh: "暂时无法完成，请稍后重试。",
    en: "The operation is temporarily unavailable. Try again later.",
  },
};

export function caioOperatorErrorMessage(code: CaioOperatorErrorCode, english: boolean): string {
  return english ? MESSAGES[code].en : MESSAGES[code].zh;
}
