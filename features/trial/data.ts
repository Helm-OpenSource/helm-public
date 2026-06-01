import type { UiLocale } from "@/lib/i18n/config";

export const TRIAL_ROLE_OPTIONS = [
  "founder",
  "sales_lead",
  "operations_lead",
  "recruiting_lead",
  "other",
] as const;

export type TrialRoleOption = (typeof TRIAL_ROLE_OPTIONS)[number];

export const TRIAL_ROLE_LABELS: Record<TrialRoleOption, { zh: string; en: string }> = {
  founder: { zh: "创始人 / COO", en: "Founder / COO" },
  sales_lead: { zh: "销售 / 商务负责人", en: "Sales / BD lead" },
  operations_lead: { zh: "经营 / 运营负责人", en: "Operations lead" },
  recruiting_lead: { zh: "招聘 / 猎头负责人", en: "Recruiting lead" },
  other: { zh: "其他", en: "Other" },
};

export type TrialApplicationInput = {
  email: string;
  organizationName: string;
  role: TrialRoleOption;
  useCase: string;
  locale?: UiLocale;
};

export type TrialApplicationResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: string };
