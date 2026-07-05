#!/usr/bin/env tsx
/**
 * Public .env.example builder.
 *
 * The private worktree's .env.example includes tenant-private deployment
 * switches. Public mirrors need a smaller, generic example that can pass the
 * local validation gate without leaking customer or tenant-specific anchors.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PUBLIC_ENV_EXAMPLE_CONTENT = `# =============================================================================
# Helm — public environment example
# =============================================================================
#
# This file is generated for the public mirror. It intentionally keeps only
# generic Open Core defaults. Tenant-private overlays and customer-specific
# connectors belong outside the public repository.

DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4"
APP_URL="http://localhost:3000"
CONNECTOR_TOKEN_SECRET="public-local-connector-token-secret-000000000000"
CONNECTOR_TOKEN_SECRET_ID="local"
CONNECTOR_TOKEN_SECRET_PREVIOUS=""
CONNECTOR_TOKEN_SECRET_PREVIOUS_ID=""

HELM_RELEASE_PROFILE="community"
# Public Core keeps global deployment defaults so forks do not imply a China
# production deployment. For China-region deployments, set both region and
# residency to \`cn\`; this remains declarative until your deployment runbook,
# infrastructure, and owner approvals are in place.
HELM_DEPLOYMENT_REGION="global"
HELM_DATA_RESIDENCY="global"
HELM_DEFAULT_LOCALE="zh-CN"
NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"

# Optional Docker build helper for Mainland China or restricted networks.
# docker-compose.yml passes this as the Dockerfile npm registry build arg.
NPM_REGISTRY=""

OPENAI_API_KEY=""
DASHSCOPE_API_KEY=""
DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
LLM_ENABLED="false"
LLM_DEFAULT_PROVIDER="qwen"
LLM_DEFAULT_MODEL="qwen3.6-plus"
LLM_EXTRACTION_MODEL="qwen3.6-plus"
LLM_BRIEFING_MODEL="qwen3.6-plus"
LLM_REASONING_MODEL="qwen3.6-plus"
LLM_BASE_URL=""
LLM_HTTP_TIMEOUT_MS=""
LLM_HTTP_TIMEOUT_MS_REASONING=""
LLM_HTTP_TIMEOUT_MS_EXTERNAL_CASE_ASSIGNMENT=""

ASR_ENABLED="false"
ASR_PROVIDER="openai"
ASR_OPENAI_MODEL="gpt-4o-mini-transcribe"
ASR_DASHSCOPE_MODEL="qwen3-asr-flash"
ASR_DASHSCOPE_BASE_URL=""
ASR_LANGUAGE="zh"

SIGNAL_COLLECTION_SCHEDULER_ENABLED="false"

ALIYUN_MAIL_FOUNDER_EMAIL=""
ALIYUN_MAIL_FOUNDER_PASSWORD=""
ALIYUN_MAIL_SYSTEM_EMAIL=""
ALIYUN_MAIL_SYSTEM_PASSWORD=""
ALIYUN_MAIL_IMAP_HOST=""
ALIYUN_MAIL_IMAP_PORT=""
ALIYUN_MAIL_SMTP_HOST=""
ALIYUN_MAIL_SMTP_PORT=""

DINGTALK_CLIENT_ID=""
DINGTALK_CLIENT_SECRET=""
DINGTALK_CORP_ID=""

WECOM_CLIENT_ID=""
WECOM_CLIENT_SECRET=""

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
ALIPAY_APP_ID=""
ALIPAY_PRIVATE_KEY=""
ALIPAY_PUBLIC_KEY=""
WECHAT_PAY_APP_ID=""
WECHAT_PAY_MERCHANT_ID=""
WECHAT_PAY_MERCHANT_SERIAL_NO=""
WECHAT_PAY_PRIVATE_KEY=""
WECHAT_PAY_PLATFORM_PUBLIC_KEY=""
WECHAT_PAY_API_V3_KEY=""

HUBSPOT_CLIENT_ID=""
HUBSPOT_CLIENT_SECRET=""
SALESFORCE_CLIENT_ID=""
SALESFORCE_CLIENT_SECRET=""
`;

export type PublicEnvExampleBuildStatus =
  | "already-projected"
  | "wrote-projection"
  | "not-projected";

export type PublicEnvExampleBuildOptions = {
  readonly repoRoot?: string;
  readonly outputPath?: string;
  readonly checkMode?: boolean;
};

export type PublicEnvExampleBuildResult = {
  readonly status: PublicEnvExampleBuildStatus;
  readonly outputPath: string;
  readonly exitCode: 0 | 1;
};

function resolveOutputPath(repoRoot: string, outputPath: string): string {
  return path.isAbsolute(outputPath) ? outputPath : path.join(repoRoot, outputPath);
}

export function buildPublicEnvExample(
  options: PublicEnvExampleBuildOptions = {},
): PublicEnvExampleBuildResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  const outputPath = resolveOutputPath(repoRoot, options.outputPath ?? ".env.example");
  const existingContent = existsSync(outputPath)
    ? readFileSync(outputPath, "utf8")
    : null;
  const matches = existingContent === PUBLIC_ENV_EXAMPLE_CONTENT;

  if (options.checkMode) {
    return {
      status: matches ? "already-projected" : "not-projected",
      outputPath,
      exitCode: matches ? 0 : 1,
    };
  }

  if (!matches) {
    writeFileSync(outputPath, PUBLIC_ENV_EXAMPLE_CONTENT, "utf8");
  }

  return {
    status: matches ? "already-projected" : "wrote-projection",
    outputPath,
    exitCode: 0,
  };
}

function parseArgs(args: string[]): PublicEnvExampleBuildOptions {
  const options: {
    checkMode?: boolean;
    outputPath?: string;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      options.checkMode = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value) throw new Error("--out requires a file path");
      index += 1;
      options.outputPath = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function main(): number {
  let result: PublicEnvExampleBuildResult;
  try {
    result = buildPublicEnvExample(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const message = `public-env-example: ${result.status} — ${result.outputPath}`;
  if (result.exitCode === 0) {
    console.log(message);
  } else {
    console.error(`${message}; run without --check to write the projection.`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
