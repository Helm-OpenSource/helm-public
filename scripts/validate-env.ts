#!/usr/bin/env tsx

/**
 * Environment Variable Validation Script
 *
 * Three-tier graded validation aligned with `.env.example`:
 *
 *   MUST                — required to start the app and reach /mobile
 *                         missing → fail
 *   OPTIONAL_AI         — Ask Helm / LLM features
 *                         missing → warn (deterministic placeholder + banner)
 *   OPTIONAL_CONNECTORS — external connectors and payment rails
 *                         missing → warn per block
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { validateDeploymentProfileEnv } from "@/lib/deployment-profile/contract";

// ---------------------------------------------------------------------------
// MUST tier — required to boot
// ---------------------------------------------------------------------------
const mustVars = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (mysql://user:pass@host:port/db)"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  CONNECTOR_TOKEN_SECRET: z
    .string()
    .min(1, "CONNECTOR_TOKEN_SECRET is required"),
});

// ---------------------------------------------------------------------------
// OPTIONAL_AI tier — Ask Helm / LLM features
// ---------------------------------------------------------------------------
const optionalAiVars = z.object({
  OPENAI_API_KEY: z.string().optional(),
  DASHSCOPE_API_KEY: z.string().optional(),
  DASHSCOPE_BASE_URL: z.string().optional(),
  LLM_ENABLED: z.string().optional(),
  LLM_DEFAULT_PROVIDER: z.string().optional(),
  LLM_DEFAULT_MODEL: z.string().optional(),
  LLM_EXTRACTION_MODEL: z.string().optional(),
  LLM_BRIEFING_MODEL: z.string().optional(),
  LLM_REASONING_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  ASR_ENABLED: z.string().optional(),
  ASR_OPENAI_MODEL: z.string().optional(),
  ASR_LANGUAGE: z.string().optional(),
});

// ---------------------------------------------------------------------------
// OPTIONAL_CONNECTORS tier — external connectors and payment rails
// ---------------------------------------------------------------------------
// Each connector block is independent. Missing keys → warn for that block only.

type ConnectorBlock = {
  name: string;
  description: string;
  keys: string[];
  // When `triggerKey` is set, the block is only checked if that key is non-empty.
  // This avoids warning about every connector when none are configured.
  triggerKey?: string;
};

const connectorBlocks: ConnectorBlock[] = [
  {
    name: "Aliyun Mail",
    description: "IMAP + SMTP via Aliyun enterprise mail",
    keys: [
      "ALIYUN_MAIL_IMAP_HOST",
      "ALIYUN_MAIL_IMAP_PORT",
      "ALIYUN_MAIL_SMTP_HOST",
      "ALIYUN_MAIL_SMTP_PORT",
    ],
    triggerKey: "ALIYUN_MAIL_FOUNDER_EMAIL",
  },
  {
    name: "DingTalk",
    description: "DingTalk MCP read-only connector",
    keys: ["DINGTALK_CLIENT_ID", "DINGTALK_CLIENT_SECRET", "DINGTALK_CORP_ID"],
    triggerKey: "DINGTALK_CLIENT_ID",
  },
  {
    name: "Stripe",
    description: "Global / English payment rail (hosted checkout + portal only)",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    triggerKey: "STRIPE_SECRET_KEY",
  },
  {
    name: "Alipay",
    description: "China payment rail (narrow checkout + notify/query sync)",
    keys: ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY"],
    triggerKey: "ALIPAY_APP_ID",
  },
  {
    name: "WeChat Pay",
    description: "China payment rail",
    keys: [
      "WECHAT_PAY_APP_ID",
      "WECHAT_PAY_MERCHANT_ID",
      "WECHAT_PAY_MERCHANT_SERIAL_NO",
      "WECHAT_PAY_PRIVATE_KEY",
    ],
    triggerKey: "WECHAT_PAY_APP_ID",
  },
  {
    name: "HubSpot",
    description: "CRM-first connector",
    keys: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
    triggerKey: "HUBSPOT_CLIENT_ID",
  },
  {
    name: "Salesforce",
    description: "CRM-first connector",
    keys: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
    triggerKey: "SALESFORCE_CLIENT_ID",
  },
  {
    name: "WeCom",
    description: "WeCom identity and read-only connector foundation",
    keys: ["WECOM_CLIENT_ID", "WECOM_CLIENT_SECRET"],
    triggerKey: "WECOM_CLIENT_ID",
  },
  {
    name: "Google Identity",
    description: "Google OAuth client",
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    triggerKey: "GOOGLE_CLIENT_ID",
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFiles() {
  const root = process.cwd();
  for (const relativePath of [".env.example", ".env"]) {
    const filePath = path.join(root, relativePath);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) {
        continue;
      }

      process.env[key] = stripWrappingQuotes(trimmed.slice(separatorIndex + 1));
    }
  }
}

function validateMust(result: ValidationResult): void {
  try {
    mustVars.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.valid = false;
      error.issues.forEach((issue) => {
        result.errors.push(
          `MUST: ${issue.path.join(".")} — ${issue.message}`,
        );
      });
    }
  }

  // Strong-secret guard for CONNECTOR_TOKEN_SECRET
  if (
    process.env.CONNECTOR_TOKEN_SECRET &&
    process.env.CONNECTOR_TOKEN_SECRET.length < 32
  ) {
    if (process.env.NODE_ENV === "production") {
      result.valid = false;
      result.errors.push(
        "MUST: CONNECTOR_TOKEN_SECRET must be at least 32 characters in production",
      );
    } else {
      result.warnings.push(
        "MUST: CONNECTOR_TOKEN_SECRET should be at least 32 characters for stronger local security",
      );
    }
  }

  // Database URL sanity
  if (process.env.DATABASE_URL?.includes("file:")) {
    result.valid = false;
    result.errors.push(
      "MUST: SQLite DATABASE_URL is no longer supported in the MySQL runtime baseline",
    );
  }
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith("mysql://")
  ) {
    result.warnings.push(
      "MUST: DATABASE_URL is not mysql://; verify this is intentional",
    );
  }
}

function validateOptionalAi(result: ValidationResult): void {
  // Schema-level check — all keys are .optional(), so this won't fail.
  // Logic: if LLM_ENABLED=true but OPENAI_API_KEY empty, warn that Ask Helm
  // will surface deterministic placeholder + banner.
  try {
    optionalAiVars.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.issues.forEach((issue) => {
        result.warnings.push(
          `OPTIONAL_AI: ${issue.path.join(".")} — ${issue.message}`,
        );
      });
    }
  }

  const llmEnabled = (process.env.LLM_ENABLED ?? "true").toLowerCase() === "true";
  const provider = (process.env.LLM_DEFAULT_PROVIDER ?? "qwen").toLowerCase();

  if (!llmEnabled) {
    return;
  }

  if (provider === "qwen") {
    const hasQwenCredential = Boolean(process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasQwenCredential) {
      result.warnings.push(
        "OPTIONAL_AI: LLM_DEFAULT_PROVIDER=qwen but both DASHSCOPE_API_KEY and OPENAI_API_KEY are empty — Ask Helm will show a deterministic placeholder + banner",
      );
    }
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    result.warnings.push(
      "OPTIONAL_AI: LLM_ENABLED=true but OPENAI_API_KEY is empty — Ask Helm will show a deterministic placeholder + banner",
    );
  }
}

function validateOptionalConnectors(result: ValidationResult): void {
  for (const block of connectorBlocks) {
    const triggered =
      block.triggerKey && process.env[block.triggerKey]
        ? true
        : false;
    if (!triggered) continue;

    const missing = block.keys.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      result.warnings.push(
        `OPTIONAL_CONNECTORS[${block.name}]: ${missing.join(", ")} — ${block.description}`,
      );
    }
  }
}

function validateDeploymentProfile(result: ValidationResult): void {
  const deploymentProfile = validateDeploymentProfileEnv({
    HELM_RELEASE_PROFILE: process.env.HELM_RELEASE_PROFILE,
    HELM_DEPLOYMENT_REGION: process.env.HELM_DEPLOYMENT_REGION,
    HELM_DATA_RESIDENCY: process.env.HELM_DATA_RESIDENCY,
    HELM_DEFAULT_LOCALE: process.env.HELM_DEFAULT_LOCALE,
  });
  for (const issue of deploymentProfile.issues) {
    result.valid = false;
    result.errors.push(
      `DEPLOYMENT_PROFILE: ${issue.envKey} — ${issue.message}`,
    );
  }
}

function validateSuspiciousDefaults(result: ValidationResult): void {
  const suspiciousDefaults = ["changeme", "secret", "example", "test"];
  Object.entries(process.env).forEach(([key, value]) => {
    if (key.includes("SECRET") || key.includes("KEY") || key.includes("PASSWORD")) {
      if (value && suspiciousDefaults.some((def) => value.toLowerCase().includes(def))) {
        result.warnings.push(
          `Suspicious value for ${key}: appears to be a default/example value`,
        );
      }
    }
  });
}

function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    recommendations: [],
  };

  validateMust(result);
  validateDeploymentProfile(result);
  validateOptionalAi(result);
  validateOptionalConnectors(result);
  validateSuspiciousDefaults(result);

  // Production-only recommendations
  if (process.env.NODE_ENV === "production") {
    if (!process.env.STRIPE_SECRET_KEY && !process.env.ALIPAY_APP_ID) {
      result.recommendations.push(
        "Production should have at least one payment rail configured (Stripe or Alipay)",
      );
    }
    if (
      !process.env.CONNECTOR_TOKEN_SECRET ||
      process.env.CONNECTOR_TOKEN_SECRET.length < 64
    ) {
      result.recommendations.push(
        "Production CONNECTOR_TOKEN_SECRET should be at least 64 characters",
      );
    }
  }

  if (
    process.env.DATABASE_URL?.includes("127.0.0.1") ||
    process.env.DATABASE_URL?.includes("localhost")
  ) {
    if (process.env.NODE_ENV === "production") {
      result.warnings.push(
        "Production deployment should avoid localhost DATABASE_URL",
      );
    } else {
      result.recommendations.push(
        "Local MySQL DATABASE_URL detected — this is expected for development",
      );
    }
  }

  return result;
}

function main() {
  loadEnvFiles();
  console.log("🔍 Validating environment configuration (MUST / OPTIONAL_AI / OPTIONAL_CONNECTORS)...\n");

  const result = validateEnvironment();

  if (result.errors.length > 0) {
    console.error("❌ ERRORS:");
    result.errors.forEach((error) => console.error(`   ${error}`));
    console.error();
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️  WARNINGS:");
    result.warnings.forEach((warning) => console.warn(`   ${warning}`));
    console.warn();
  }

  if (result.recommendations.length > 0) {
    console.info("💡 RECOMMENDATIONS:");
    result.recommendations.forEach((rec) => console.info(`   ${rec}`));
    console.info();
  }

  if (result.valid) {
    console.log("✅ Environment validation passed (MUST tier).\n");
    process.exit(0);
  } else {
    console.error("❌ Environment validation failed! MUST tier has unresolved issues.\n");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { validateEnvironment };
