export type WorkBuddyFeatureFlags = Readonly<{
  gatewayEnabled: boolean;
  readEnabled: boolean;
  pushEnabled: boolean;
  presenceEnabled: boolean;
  mutationsEnabled: boolean;
  promptResponsesEnabled: boolean;
  questionSelectionsEnabled: boolean;
  adviceDecisionsEnabled: boolean;
}>;

export const DEFAULT_WORKBUDDY_FEATURE_FLAGS: WorkBuddyFeatureFlags =
  Object.freeze({
    gatewayEnabled: false,
    readEnabled: false,
    pushEnabled: false,
    presenceEnabled: false,
    mutationsEnabled: false,
    promptResponsesEnabled: false,
    questionSelectionsEnabled: false,
    adviceDecisionsEnabled: false,
  });

type Environment = Readonly<Record<string, string | undefined>>;

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function loadWorkBuddyFeatureFlags(
  env: Environment,
): WorkBuddyFeatureFlags {
  return Object.freeze({
    gatewayEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_GATEWAY_ENABLED,
    ),
    readEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_READ_ENABLED,
    ),
    pushEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_PUSH_ENABLED,
    ),
    presenceEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_PRESENCE_ENABLED,
    ),
    mutationsEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_MUTATIONS_ENABLED,
    ),
    promptResponsesEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_PROMPT_RESPONSES_ENABLED,
    ),
    questionSelectionsEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_QUESTION_SELECTIONS_ENABLED,
    ),
    adviceDecisionsEnabled: isExplicitlyEnabled(
      env.CAIO_WORKBUDDY_ADVICE_DECISIONS_ENABLED,
    ),
  });
}
