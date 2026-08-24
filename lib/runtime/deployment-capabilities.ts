export type DeploymentCapability =
  | "llm_provider"
  | "outbound_voice_asr"
  | "engineering_review_cron"
  | "signal_runtime_write"
  | "dingtalk_sync"
  | "dingtalk_bridge"
  | "customer_visible_send"
  | "automated_customer_call"
  | "sms_send"
  | "financial_action";

type DeploymentEnvironment = Readonly<Record<string, string | undefined>>;

export type DeploymentCapabilityDecision = {
  allowed: boolean;
  capability: DeploymentCapability;
  envKey: string;
  reason:
    | "explicitly_enabled"
    | "explicitly_disabled"
    | "legacy_default_enabled"
    | "safe_default_disabled"
    | "invalid_control";
};

const CAPABILITY_CONTROLS: Record<
  DeploymentCapability,
  { envKey: string; defaultAllowed: boolean }
> = {
  llm_provider: { envKey: "LLM_ENABLED", defaultAllowed: true },
  outbound_voice_asr: {
    envKey: "HELM_OUTBOUND_VOICE_ASR_ENABLED",
    defaultAllowed: false,
  },
  engineering_review_cron: {
    envKey: "ENGINEERING_REVIEW_CRON_ENABLED",
    defaultAllowed: true,
  },
  signal_runtime_write: {
    envKey: "HELM_SIGNAL_RUNTIME_WRITES_ENABLED",
    defaultAllowed: true,
  },
  dingtalk_sync: {
    envKey: "DINGTALK_RUNTIME_SYNC_ENABLED",
    defaultAllowed: true,
  },
  dingtalk_bridge: {
    envKey: "DINGTALK_WORKFLOW_BRIDGE_ENABLED",
    defaultAllowed: true,
  },
  customer_visible_send: {
    envKey: "HELM_CUSTOMER_VISIBLE_SENDS_ENABLED",
    defaultAllowed: true,
  },
  automated_customer_call: {
    envKey: "HELM_AUTOMATED_CUSTOMER_CALLS_ENABLED",
    defaultAllowed: false,
  },
  sms_send: {
    envKey: "HELM_SMS_SENDS_ENABLED",
    defaultAllowed: false,
  },
  financial_action: {
    envKey: "HELM_FINANCIAL_ACTIONS_ENABLED",
    defaultAllowed: true,
  },
};

export function getDeploymentCapabilityDecision(
  capability: DeploymentCapability,
  env: DeploymentEnvironment = process.env,
): DeploymentCapabilityDecision {
  const control = CAPABILITY_CONTROLS[capability];
  const rawValue = env[control.envKey];
  const normalized = rawValue?.trim().toLowerCase();

  if (!normalized) {
    return {
      allowed: control.defaultAllowed,
      capability,
      envKey: control.envKey,
      reason: control.defaultAllowed
        ? "legacy_default_enabled"
        : "safe_default_disabled",
    };
  }
  if (normalized === "true") {
    return {
      allowed: true,
      capability,
      envKey: control.envKey,
      reason: "explicitly_enabled",
    };
  }
  if (normalized === "false") {
    return {
      allowed: false,
      capability,
      envKey: control.envKey,
      reason: "explicitly_disabled",
    };
  }
  return {
    allowed: false,
    capability,
    envKey: control.envKey,
    reason: "invalid_control",
  };
}

export function isDeploymentCapabilityEnabled(
  capability: DeploymentCapability,
  env: DeploymentEnvironment = process.env,
) {
  return getDeploymentCapabilityDecision(capability, env).allowed;
}

export class DeploymentCapabilityDisabledError extends Error {
  readonly code = "deployment_capability_disabled";

  constructor(readonly capability: DeploymentCapability) {
    super(`deployment_capability_disabled:${capability}`);
    this.name = "DeploymentCapabilityDisabledError";
  }
}

export function assertDeploymentCapabilityEnabled(
  capability: DeploymentCapability,
  env: DeploymentEnvironment = process.env,
) {
  if (!isDeploymentCapabilityEnabled(capability, env)) {
    throw new DeploymentCapabilityDisabledError(capability);
  }
}
