import { RejectionReasonCode } from "@prisma/client";

// Bilingual labels for the structured rejection taxonomy. Kept dependency-free
// so both server actions and client components can import it.
export const REJECTION_REASON_LABELS: Record<
  RejectionReasonCode,
  { zh: string; en: string }
> = {
  [RejectionReasonCode.DIAGNOSIS_ERROR]: {
    zh: "判断有误：AI 对问题或机会的判断不成立",
    en: "Diagnosis error: the AI's reading of the problem or opportunity does not hold",
  },
  [RejectionReasonCode.BOUNDARY_ERROR]: {
    zh: "越界：动作超出授权边界或承诺边界",
    en: "Boundary error: the action exceeds an authorization or commitment boundary",
  },
  [RejectionReasonCode.OWNER_DISAGREEMENT]: {
    zh: "负责人另有决策：判断成立但负责人选择不同做法",
    en: "Owner disagreement: the reading holds but the owner chose a different path",
  },
  [RejectionReasonCode.EVIDENCE_MISSING]: {
    zh: "证据不足：支撑该动作的证据缺失或过期",
    en: "Evidence missing: the supporting evidence is absent or stale",
  },
  [RejectionReasonCode.EXECUTION_UNFIT]: {
    zh: "不适合执行：动作本身可议但当前执行面或时机不合适",
    en: "Execution unfit: the action is arguable but the surface or timing is wrong",
  },
  [RejectionReasonCode.OTHER]: {
    zh: "其他原因",
    en: "Other reason",
  },
};

export function getRejectionReasonLabel(
  code: RejectionReasonCode,
  english: boolean,
): string {
  const label = REJECTION_REASON_LABELS[code];
  return english ? label.en : label.zh;
}

// Compact labels for tight UI surfaces (select items, badges). The full
// labels above stay the canonical audit / memory wording.
export const REJECTION_REASON_SHORT_LABELS: Record<
  RejectionReasonCode,
  { zh: string; en: string }
> = {
  [RejectionReasonCode.DIAGNOSIS_ERROR]: { zh: "判断有误", en: "Wrong diagnosis" },
  [RejectionReasonCode.BOUNDARY_ERROR]: { zh: "越界", en: "Boundary breach" },
  [RejectionReasonCode.OWNER_DISAGREEMENT]: { zh: "另有决策", en: "Owner decided otherwise" },
  [RejectionReasonCode.EVIDENCE_MISSING]: { zh: "证据不足", en: "Evidence missing" },
  [RejectionReasonCode.EXECUTION_UNFIT]: { zh: "时机或执行面不合适", en: "Wrong surface or timing" },
  [RejectionReasonCode.OTHER]: { zh: "其他原因", en: "Other reason" },
};

export function getRejectionReasonShortLabel(
  code: RejectionReasonCode,
  english: boolean,
): string {
  const label = REJECTION_REASON_SHORT_LABELS[code];
  return english ? label.en : label.zh;
}

export const REJECTION_REASON_CODES: RejectionReasonCode[] = [
  RejectionReasonCode.DIAGNOSIS_ERROR,
  RejectionReasonCode.BOUNDARY_ERROR,
  RejectionReasonCode.OWNER_DISAGREEMENT,
  RejectionReasonCode.EVIDENCE_MISSING,
  RejectionReasonCode.EXECUTION_UNFIT,
  RejectionReasonCode.OTHER,
];
