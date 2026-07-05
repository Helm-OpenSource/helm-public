/**
 * Effect-mode badge contract.
 *
 * Ported design language from the NPA pack's effectMode corner mark: every
 * surfaced item can declare whether it is a suggestion, a shadow suggestion,
 * a human action, or a receipt — so "recommendation vs commitment" stays
 * visually unmistakable. Unknown modes render as an explicit danger state
 * instead of silently defaulting.
 */

export const EFFECT_MODES = [
  "suggestion_only",
  "shadow_suggestion",
  "human_action",
  "receipt",
] as const;

export type EffectMode = (typeof EFFECT_MODES)[number];

export type EffectModeBadgeVariant =
  | "info"
  | "approval"
  | "warning"
  | "success"
  | "danger";

export interface EffectModeBadgePresentation {
  readonly known: boolean;
  readonly variant: EffectModeBadgeVariant;
  readonly label: string;
}

const EFFECT_MODE_PRESENTATION: Record<
  EffectMode,
  { variant: EffectModeBadgeVariant; zh: string; en: string }
> = {
  suggestion_only: {
    variant: "info",
    zh: "仅建议",
    en: "Suggestion only",
  },
  shadow_suggestion: {
    variant: "approval",
    zh: "建议（shadow）",
    en: "Suggestion (shadow)",
  },
  human_action: {
    variant: "warning",
    zh: "人工动作",
    en: "Human action",
  },
  receipt: {
    variant: "success",
    zh: "回执",
    en: "Receipt",
  },
};

export function resolveEffectModeBadge(
  mode: string,
  english: boolean,
): EffectModeBadgePresentation {
  if ((EFFECT_MODES as readonly string[]).includes(mode)) {
    const entry = EFFECT_MODE_PRESENTATION[mode as EffectMode];
    return {
      known: true,
      variant: entry.variant,
      label: english ? entry.en : entry.zh,
    };
  }
  return {
    known: false,
    variant: "danger",
    label: english
      ? `Unknown effect mode: ${mode}`
      : `未知效果模式：${mode}`,
  };
}
