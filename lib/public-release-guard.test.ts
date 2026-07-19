import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  projectPublicPackageManifest,
  runPublicReleaseGuard,
  sha256Hex,
  validatePublicPackageManifestProjection,
} from "../scripts/public-release-guard";

let fixtureRoot: string;

const tenantSlug = ["guang", "pu"].join("");
const tenantPrivateRoot = ["extensions", tenantSlug].join("/");
const implementationConsolePrivateRoot = [
  "extensions",
  "helm-implementation-console",
].join("/");
const commercialPrivateRoot = ["customer", "proof", "packs"].join("-");
const rmShuyaoHost = [["rm", "shuyao-dev"].join("-"), "aliyuncs", "com"].join(".");
const mysqlRdsHost = [["rm", "shuyao-dev", "pub"].join("-"), "mysql", "rds", "aliyuncs", "com"].join(".");
const aliyunRdsHost = ["example-prod", "rds", "aliyuncs", "com"].join(".");
const customerHost = ["helm", ["aicai", "group"].join(""), "com"].join(".");
const privateEmail = ["member", [["360", "amc"].join(""), "cn"].join(".")].join("@");
const realMobile = ["+86", ["139", "5804", "4686"].join("")].join("");
const personWang = ["王", "丽", "珍"].join("");
const personLi = ["李", "建", "乐"].join("");
const companyCn = ["杭州", "光", "潽", "科技有限公司"].join("");
const internalIp = ["10", "16", "10", "55"].join(".");
const urlCredential = ["mysql://root", "RealPass123"].join(":") + "@db.example.com/helm";
const placeholderUrlCredential = ["mysql://root", "password"].join(":") + "@localhost:3306/helm";
const rmShuyaoRule = ["internal-host", ["rm", "shuyao"].join("-")].join(":");
const helmRegisteredMark = ["Helm", "\u00ae"].join("");
const poweredByHelm = ["Powered", "by", "Helm"].join(" ");
const runtimeForcePhrase = ["must be", "retained"].join(" ");
const founderLoopFullRequirementsBasename =
  ["HELM", "FOUNDER", "OPERATING", "LOOP", "REQUIREMENTS", "V1"].join("_") +
  ".md";
const founderLoopFullRequirementsInternalPath = [
  "docs",
  "internal",
  "product",
  founderLoopFullRequirementsBasename,
].join("/");

function writeFixture(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function runGuard(knownLeakedTokenSha256 = new Set<string>()) {
  return runPublicReleaseGuard({
    repoRoot: fixtureRoot,
    knownLeakedTokenSha256,
  });
}

function runGuardWithLocalBuildArtifacts() {
  return runPublicReleaseGuard({
    repoRoot: fixtureRoot,
    includeLocalBuildArtifacts: true,
  });
}

describe("public release guard fixture coverage", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-release-guard-"));
    writeFixture(
      "LICENSE",
      ["Apache License", "Version 2.0, January 2004"].join("\n"),
    );
    writeFixture(
      "NOTICE",
      [
        "Helm",
        "Licensed under the Apache License, Version 2.0",
      ].join("\n"),
    );
    writeFixture(
      "package.json",
      JSON.stringify(
        {
          name: "helm-console",
          private: true,
          license: "Apache-2.0",
          scripts: {
            dev: "next dev",
          },
        },
        null,
        2,
      ),
    );
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("flags URL-embedded credentials and redacts the leaked value from excerpts", () => {
    writeFixture("docs/public.md", `Use ${urlCredential} here.`);

    const result = runGuard();

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "credential:url-embedded",
      path: "docs/public.md",
      line: 1,
    });
    expect(result.violations[0]?.excerpt).toContain("mysql://root:***@");
    expect(result.violations[0]?.excerpt).not.toContain("RealPass123");
  });

  it("allows documented placeholder credentials in example URLs", () => {
    writeFixture("docs/public.md", `Use ${placeholderUrlCredential} for local examples.`);

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("flags synthetic known leaked token hashes without storing real leaked plaintext", () => {
    const syntheticLeak = "SyntheticLeakToken123ABCdef";
    writeFixture("docs/public.md", `API_TOKEN="${syntheticLeak}"`);

    const result = runGuard(new Set([sha256Hex(syntheticLeak)]));

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "credential:known-leaked-token",
      path: "docs/public.md",
      line: 1,
    });
    expect(result.violations[0]?.excerpt).toContain('API_TOKEN="***"');
    expect(result.violations[0]?.excerpt).not.toContain(syntheticLeak);
  });

  it("flags assignment-form bare-token credentials and redacts the value", () => {
    // Held in a non-keyword variable and interpolated so this synthetic value
    // is not itself a `KEYWORD=<literal>` assignment in this test's source
    // (which the guard also scans) — same discipline as the known-leaked test.
    const syntheticAssignmentValue = "Ab3xK9mQ2pLw7Vn4Zt";
    writeFixture("docs/public.md", `DB_PASSWORD = "${syntheticAssignmentValue}"`);

    const result = runGuard();

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "credential:assignment-form",
      path: "docs/public.md",
      line: 1,
    });
    expect(result.violations[0]?.excerpt).not.toContain(syntheticAssignmentValue);
    expect(result.violations[0]?.excerpt).toContain("***");
  });

  it("does not flag placeholder, env-ref, or identifier-shaped assignments", () => {
    writeFixture(
      "docs/public.md",
      [
        "DB_PASSWORD=changeme",
        "DB_PASSWORD=$DATABASE_PASSWORD",
        'it("throws Phase3qRejectionError for input with secret key")',
        "password: hunter2",
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("still runs credential checks on policy descriptor files", () => {
    writeFixture(
      "README.md",
      `Policy doc can mention ${tenantSlug} and ${tenantPrivateRoot}, but not ${urlCredential}.`,
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "credential:url-embedded",
    ]);
  });

  it("does not scan private roots that are excluded from the public mirror", () => {
    writeFixture(
      path.posix.join(tenantPrivateRoot, "private.md"),
      `Private tenant file with ${tenantSlug}, ${rmShuyaoHost} and ${urlCredential}.`,
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("flags public references to the internal Founder Loop full requirements document", () => {
    writeFixture(
      "README.md",
      [
        `Do not link ${founderLoopFullRequirementsBasename} from public docs.`,
        `Do not link ${founderLoopFullRequirementsInternalPath} from public docs.`,
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "private-doc-ref:founder-operating-loop-full-requirements",
      "private-doc-ref:founder-operating-loop-internal-path",
    ]);
  });

  it("does not scan the internal Founder Loop full requirements document itself", () => {
    writeFixture(
      founderLoopFullRequirementsInternalPath,
      `# ${founderLoopFullRequirementsBasename}\nInternal-only requirements.`,
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("does not scan private files that are excluded from the public mirror", () => {
    writeFixture(
      "docs/HELM_INTERNAL_FREEZE_REFERENCE.md",
      `Internal freeze reference with ${tenantSlug}, ${rmShuyaoHost} and ${urlCredential}.`,
    );
    writeFixture(
      [
        "docs",
        "internal",
        "launch",
        `${tenantSlug.toUpperCase()}_${["MI", "DUN"].join("")}_USER_MAPPING_REQUIREMENTS.md`,
      ].join("/"),
      `Tenant launch note with ${tenantSlug}, ${rmShuyaoHost} and ${urlCredential}.`,
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("does not scan local-only env files that can carry developer credentials", () => {
    writeFixture(".env.local", `DATABASE_URL="${urlCredential}"\nTENANT=${tenantSlug}`);
    writeFixture("nested/.env.test", `DATABASE_URL="${urlCredential}"`);

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("scans .env.example because it is a public startup artifact", () => {
    writeFixture(".env.example", `TENANT_KEY="${tenantSlug}"`);

    const result = runGuard();

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: `tenant-slug:${tenantSlug}`,
      path: ".env.example",
      line: 1,
    });
  });

  it("flags tenant slugs, private path references, and internal hosts in public files", () => {
    writeFixture(
      "docs/public.md",
      [
        `Do not mention ${tenantSlug} in public release notes.`,
        `Do not link ${commercialPrivateRoot} from public docs.`,
        `Do not mention ${rmShuyaoHost} in public docs.`,
        `Do not mention ${mysqlRdsHost} in public docs.`,
        `Do not mention ${aliyunRdsHost} in public docs.`,
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      `tenant-slug:${tenantSlug}`,
      `private-path-ref:${commercialPrivateRoot}`,
      rmShuyaoRule,
      "internal-host:rm-shuyao",
      "internal-host:aliyun-mysql-rds-host",
      "internal-host:aliyun-rds-host",
      "internal-host:aliyun-rds-host",
    ]);
  });

  it("flags customer PII even when a policy descriptor would allow tenant-boundary prose", () => {
    writeFixture(
      "README.md",
      [
        `Policy docs cannot carry ${customerHost}.`,
        `Policy docs cannot carry ${privateEmail}.`,
        `Policy docs cannot carry ${realMobile}.`,
        `Policy docs cannot name ${personWang} or ${personLi}.`,
        `Policy docs cannot name ${companyCn}.`,
        `Policy docs cannot carry RFC1918 ${internalIp}.`,
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "internal-host:customer-domain-a-host",
      "internal-host:customer-domain-e-host",
      "cn-mobile",
      "person-name:wang-lizhen",
      "person-name:li-jianle",
      `customer-name:${tenantSlug}-cn`,
      "internal-ip:rfc1918",
    ]);
  });

  it("allows the reviewed public security disclosure email without opening the whole domain", () => {
    writeFixture(
      "SECURITY.md",
      "Report undisclosed vulnerabilities to Helm-security@zhaojiling.com.",
    );
    writeFixture(
      "docs/public.md",
      "Do not publish another contact such as ops@zhaojiling.com.",
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "tenant-slug:zhaojiling",
      "internal-host:customer-domain-c-host",
    ]);
    expect(result.violations.every((violation) => violation.path === "docs/public.md")).toBe(true);
  });

  it("requires public release license and notice baseline files", () => {
    rmSync(path.join(fixtureRoot, "LICENSE"), { force: true });
    rmSync(path.join(fixtureRoot, "NOTICE"), { force: true });

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "license-baseline:missing-license",
      "license-baseline:missing-notice",
    ]);
  });

  it("requires projected public package manifests to keep Apache-2.0 license metadata", () => {
    writeFixture(
      "package.json",
      JSON.stringify(
        {
          name: "helm-console",
          private: true,
          license: "MIT",
          scripts: {
            dev: "next dev",
          },
        },
        null,
        2,
      ),
    );

    const result = runGuard();

    expect(result.violations).toEqual([
      {
        rule: "license-baseline:package-license",
        path: "package.json",
        line: 1,
        excerpt: "public package manifest must declare license=Apache-2.0",
      },
    ]);
  });

  it("flags public source files that carry a conflicting SPDX license header", () => {
    writeFixture(
      "lib/conflicting-license.ts",
      ["// SPDX-License-Identifier: GPL-3.0-only", "export const value = true;"].join("\n"),
    );

    const result = runGuard();

    expect(result.violations).toEqual([
      {
        rule: "license-header:non-apache",
        path: "lib/conflicting-license.ts",
        line: 1,
        excerpt: "// SPDX-License-Identifier: GPL-3.0-only",
      },
    ]);
  });

  it("flags trademark terms that imply unauthorized registered mark usage or runtime force", () => {
    writeFixture(
      "docs/public.md",
      [
        `Ship this fork as ${helmRegisteredMark} Enterprise.`,
        `${poweredByHelm} ${runtimeForcePhrase} in all derivative runtime UI.`,
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      "trademark:registered-mark",
      "trademark:powered-by-runtime-force",
    ]);
  });

  it("allows boundary wording that says Powered by Helm is not runtime-forced", () => {
    writeFixture(
      "docs/public.md",
      "Open Core cannot claim `Powered by Helm` must be retained at runtime.",
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("keeps nested package manifests in the raw scanner", () => {
    writeFixture(
      "packages/example/package.json",
      JSON.stringify({
        scripts: {
          "tenant-private": `tsx ${tenantPrivateRoot}/private-tool.ts`,
        },
      }),
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      `tenant-slug:${tenantSlug}`,
      `private-path-ref:${tenantPrivateRoot}`,
    ]);
  });

  it("scans source map artifacts inside generated build directories", () => {
    writeFixture(
      ".next/static/chunks/app.js.map",
      JSON.stringify({
        version: 3,
        sources: [`webpack://helm/./${tenantPrivateRoot}/private.ts`],
      }),
    );

    const result = runGuardWithLocalBuildArtifacts();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      `source-map:tenant-slug:${tenantSlug}`,
      `source-map:private-path-ref:${tenantPrivateRoot}`,
    ]);
  });

  it("skips local Next build artifacts unless explicitly included", () => {
    writeFixture(
      ".next/static/chunks/app.js.map",
      JSON.stringify({
        version: 3,
        sources: [`webpack://helm/./${tenantPrivateRoot}/private.ts`],
      }),
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("scans SBOM artifacts for private roots and internal hosts", () => {
    writeFixture(
      "dist/sbom.cyclonedx.json",
      JSON.stringify({
        components: [
          { name: commercialPrivateRoot, purl: `pkg:file/${commercialPrivateRoot}` },
          { name: "db", externalReferences: [{ url: `mysql://${rmShuyaoHost}` }] },
        ],
      }),
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      `sbom:internal-host:${["rm", "shuyao"].join("-")}`,
      `sbom:private-path-ref:${commercialPrivateRoot}`,
    ]);
  });

  it("scans release artifacts for customer display names", () => {
    const customerDisplayName = ["米", "盾", "云"].join("");
    writeFixture(
      "build/release.sbom.json",
      JSON.stringify({
        metadata: {
          supplier: customerDisplayName,
        },
      }),
    );

    const result = runGuard();
    const customerNameRule = [
      "sbom",
      "customer-name",
      ["mi", "dun-cn"].join(""),
    ].join(":");

    expect(result.violations.map((violation) => violation.rule)).toEqual([customerNameRule]);
  });

  it("flags tenant customer display names in release artifacts", () => {
    const customerDisplayName = ["光", "谱"].join("");
    writeFixture(
      "build/release.sbom.json",
      JSON.stringify({
        metadata: {
          supplier: customerDisplayName,
        },
      }),
    );

    const result = runGuard();
    const customerNameRule = [
      "sbom",
      "customer-name",
      [tenantSlug, "cn"].join("-"),
    ].join(":");

    expect(result.violations.map((violation) => violation.rule)).toEqual([customerNameRule]);
  });

  it("flags deployment profile env usage as a public commercial entitlement boundary", () => {
    const releaseProfileEnv = ["HELM", "RELEASE", "PROFILE"].join("_");
    writeFixture(
      "app/entitlements.ts",
      [
        "export function canUseEnterpriseFeature() {",
        `  return process.env.${releaseProfileEnv} === "enterprise";`,
        "}",
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations).toEqual([
      {
        rule: "commercial-entitlement:deployment-profile-env",
        path: "app/entitlements.ts",
        line: 2,
        excerpt: `return process.env.${releaseProfileEnv} === "enterprise";`,
      },
    ]);
  });

  it("flags public browser env vars that look like commercial authority", () => {
    const browserLicenseEnv = [
      "NEXT",
      "PUBLIC",
      "ENTERPRISE",
      "LICENSE",
    ].join("_");
    writeFixture(
      "features/billing/client.tsx",
      [
        "export function hasPaidPlan() {",
        `  return process.env.${browserLicenseEnv} === "true";`,
        "}",
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations).toEqual([
      {
        rule: "commercial-entitlement:next-public-authority",
        path: "features/billing/client.tsx",
        line: 2,
        excerpt: `return process.env.${browserLicenseEnv} === "true";`,
      },
    ]);
  });

  it("allows deployment profile validation and default locale reads", () => {
    const releaseProfileEnv = ["HELM", "RELEASE", "PROFILE"].join("_");
    const defaultLocaleEnv = ["HELM", "DEFAULT", "LOCALE"].join("_");
    writeFixture(
      "lib/deployment-profile/contract.ts",
      `const value = env.${releaseProfileEnv};`,
    );
    writeFixture(
      "scripts/validate-env.ts",
      `const value = process.env.${releaseProfileEnv};`,
    );
    writeFixture(
      "lib/delivery-engineer/golden-path-doctor.ts",
      `const value = process.env.${releaseProfileEnv};`,
    );
    writeFixture(
      "lib/delivery-engineer/golden-path-doctor.test.ts",
      `const value = process.env.${releaseProfileEnv};`,
    );
    writeFixture(
      "app/layout.tsx",
      `const locale = process.env.${defaultLocaleEnv};`,
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("fails Docker context checks when full-context copy omits private roots from dockerignore", () => {
    writeFixture("Dockerfile", "FROM node:22-slim\nCOPY . .\n");
    writeFixture(".dockerignore", "node_modules\n");
    writeFixture(
      `${implementationConsolePrivateRoot}/runtime.ts`,
      "private runtime",
    );

    const result = runGuard();

    expect(result.violations).toEqual([
      {
        rule: "docker-context:missing-private-root-ignore",
        path: ".dockerignore",
        line: 1,
        excerpt:
          `Dockerfile copies the full build context; .dockerignore must exclude ${implementationConsolePrivateRoot}.`,
      },
    ]);
  });

  it("checks Dockerfile variants for full-context private-root ignores", () => {
    writeFixture("Dockerfile.prod", "FROM node:22-slim\nCOPY . .\n");
    writeFixture(".dockerignore", "node_modules\n");
    writeFixture(
      `${implementationConsolePrivateRoot}/runtime.ts`,
      "private runtime",
    );

    const result = runGuard();

    expect(result.violations).toEqual([
      {
        rule: "docker-context:missing-private-root-ignore",
        path: ".dockerignore",
        line: 1,
        excerpt:
          `Dockerfile.prod copies the full build context; .dockerignore must exclude ${implementationConsolePrivateRoot}.`,
      },
    ]);
  });

  it("passes Docker context checks when private roots are excluded from dockerignore", () => {
    writeFixture("Dockerfile", "FROM node:22-slim\nCOPY . .\n");
    writeFixture(
      ".dockerignore",
      [
        "node_modules",
        `${implementationConsolePrivateRoot}/`,
        `${tenantPrivateRoot}/`,
      ].join("\n"),
    );
    writeFixture(
      `${implementationConsolePrivateRoot}/runtime.ts`,
      "private runtime",
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
  });

  it("flags direct private references inside Docker context files", () => {
    writeFixture(".dockerignore", `${tenantPrivateRoot}/\n`);
    writeFixture(
      "Dockerfile",
      `FROM node:22-slim\nCOPY ${tenantPrivateRoot} /app/${tenantPrivateRoot}\n`,
    );

    const result = runGuard();

    expect(result.violations.map((violation) => violation.rule)).toEqual([
      `docker-context:tenant-slug:${tenantSlug}`,
      `docker-context:private-path-ref:${tenantPrivateRoot}`,
    ]);
  });

  it("projects a public package manifest without tenant-private scripts", () => {
    const projection = projectPublicPackageManifest({
      name: "helm-console",
      private: true,
      license: "Apache-2.0",
      scripts: {
        dev: "next dev",
        "self-check": "tsx scripts/helm-self-check-refactored.ts",
        "release:check": "tsx scripts/release-readiness-check.ts",
        "eval:signal-first-mile-quality":
          "node templates/signal-first-mile/signal-quality-eval.js templates/signal-first-mile/signal-ledger.sample.json templates/signal-first-mile/signal-quality-goldens.sample.json",
        "eval:operating-harness-contracts":
          "vitest run lib/operating-harness/contracts.test.ts --config vitest.public.config.ts",
        "eval:operating-harness-p0":
          "vitest run lib/operating-harness/contracts.test.ts lib/operating-harness/canonical.test.ts --config vitest.public.config.ts",
        "eval:operating-harness-p1":
          "vitest run lib/operating-harness/contracts.test.ts lib/operating-harness/canonical.test.ts lib/operating-harness/harness.test.ts --config vitest.public.config.ts",
        [`seed:${tenantSlug}-workspace`]: `tsx ${tenantPrivateRoot}/scripts/seed-workspace.ts`,
        "proof-pack:build": `tsx ${commercialPrivateRoot}/build.ts`,
      },
    });

    expect(projection.manifest.private).toBe(false);
    expect(projection.removedScripts).toEqual([
      `seed:${tenantSlug}-workspace`,
      "proof-pack:build",
    ]);
    expect(projection.manifest.scripts).toMatchObject({
      "self-check":
        "npm run public:smoke:static && npm run check:secret-history",
      "release:check": "node --import tsx scripts/release-readiness-check.ts",
      dev: "next dev",
      typecheck: "tsc --noEmit --project tsconfig.public.json",
      "db:prepare":
        "node -e \"console.log('public mirror: database prepare is not required')\"",
      "check:boundaries":
        "npm run public:smoke:static && npm run check:golden-path-docs && npm run check:source-profiler-boundaries && npm run check:diagnostics-risk && npm run check:llm-candidate-boundaries && npm run check:recoverable-agent-runtime && npm run check:agentic-sarp && npm run check:work-unit-governance && npm run check:ai-shelf-trust-center-contract && npm run check:stage1-owner-loop",
      "check:source-profiler-boundaries":
        "node --import tsx scripts/check-source-profiler-boundaries.ts",
      "check:golden-path-docs":
        "node --import tsx scripts/check-golden-path-docs.ts",
      "check:diagnostics-risk":
        "node --import tsx scripts/check-diagnostics-risk.ts",
      "check:llm-candidate-boundaries":
        "node --import tsx scripts/check-llm-candidate-boundaries.ts",
      "check:recoverable-agent-runtime":
        "node --import tsx scripts/check-recoverable-agent-runtime.ts",
      "check:agentic-sarp": "node --import tsx scripts/check-agentic-sarp.ts",
      "check:work-unit-governance":
        "node --import tsx scripts/check-work-unit-governance.ts",
      "check:ai-shelf-trust-center-contract":
        "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts",
      "check:stage1-owner-loop":
        "node --import tsx scripts/check-stage1-owner-loop.ts && vitest run lib/stage1-owner-loop features/dashboard/stage1-owner-loop-readout.test.ts features/dashboard/stage1-owner-loop-console-accessibility.test.ts --config vitest.public.config.ts",
      "sarp:proof": "node --import tsx scripts/sarp-proof.ts",
      "eval:llm-critic-boundaries":
        "vitest run lib/evals/llm-critic-evals.test.ts",
      "eval:llm-v2-boundaries":
        "vitest run lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts",
      "eval:llm-trajectory-harness": "vitest run lib/evals/llm-trajectory-harness.test.ts",
      "eval:llm-v3-boundaries":
        "vitest run lib/llm/intelligence-contracts-v3.test.ts lib/llm/reasoning-budget.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
      "eval:governed-runtime-contracts":
        "vitest run lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx scripts/check-llm-candidate-boundaries.test.ts --config vitest.public.config.ts",
      "eval:recoverable-agent-runtime":
        "vitest run lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts scripts/check-recoverable-agent-runtime.test.ts --config vitest.public.config.ts",
      test: "vitest run --config vitest.public.config.ts",
      "test:public:guards":
        "vitest run lib/public-release-guard.test.ts lib/public-mirror-semantic-entry-docs.test.ts scripts/check-llm-candidate-boundaries.test.ts scripts/check-recoverable-agent-runtime.test.ts scripts/check-agentic-sarp.test.ts scripts/check-work-unit-governance.test.ts lib/work-unit-governance/runtime.test.ts lib/work-unit-governance/mainline-ledger.test.ts features/work-unit-governance/work-unit-review-console.test.tsx features/work-unit-governance/work-unit-mainline-ledger-panel.test.tsx scripts/check-ai-shelf-trust-center-contract.test.ts scripts/sarp-proof.test.ts lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts lib/evals/llm-critic-evals.test.ts lib/llm/runtime-permission.test.ts lib/llm/overlay-context-hygiene.test.ts lib/llm/intelligence-contracts-v2.test.ts lib/llm/intelligence-contracts-v3.test.ts lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx lib/llm/reasoning-budget.test.ts lib/llm-workflows/review-counterfactual.workflow.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
      "quality:regression":
        "npm run test:public:guards && npm run public:smoke:static",
      "public:e2e:smoke": "npm run public:smoke:static",
      e2e: "npm run public:e2e:smoke",
      "check:public-docs": "node --import tsx scripts/check-public-docs-curation.ts",
      "eval:signal-first-mile-quality":
        "node templates/signal-first-mile/signal-quality-eval.js templates/signal-first-mile/signal-ledger.sample.json templates/signal-first-mile/signal-quality-goldens.sample.json",
      "eval:operating-harness-contracts":
        "vitest run lib/operating-harness/contracts.test.ts --config vitest.public.config.ts",
      "eval:operating-harness-p0":
        "vitest run lib/operating-harness/contracts.test.ts lib/operating-harness/canonical.test.ts --config vitest.public.config.ts",
      "eval:operating-harness-p1":
        "vitest run lib/operating-harness/contracts.test.ts lib/operating-harness/canonical.test.ts lib/operating-harness/harness.test.ts --config vitest.public.config.ts",
      "check:public-commit-metadata":
        "node --import tsx scripts/public-commit-metadata-check.ts",
      "check:public-release":
        "npm run check:public-docs && node --import tsx scripts/public-release-guard.ts",
      "public:smoke:static":
        "npm run check:public-docs && node --import tsx scripts/public-mirror-smoke.ts --repo-root .",
      "public:smoke": "node --import tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
    });
    expect(validatePublicPackageManifestProjection(projection)).toEqual([]);
  });

  it("validates projected public package manifests against private script references", () => {
    const projection = {
      removedScripts: [],
      manifest: {
        private: true,
        license: "Apache-2.0",
        scripts: {
          dev: "next dev",
          leak: `tsx ${tenantPrivateRoot}/scripts/leak.ts`,
        },
      },
    };

    expect(
      validatePublicPackageManifestProjection(projection).map(
        (violation) => violation.rule,
      ),
    ).toEqual(["package-json:private-true", "package-json:private-script"]);
  });

  it("flags app/api/debug-* routes as a path-only public-release blocker", () => {
    writeFixture(
      "app/api/debug-env/route.ts",
      [
        'import { NextResponse } from "next/server";',
        "export async function GET() {",
        "  return NextResponse.json({ ok: true });",
        "}",
      ].join("\n"),
    );

    const result = runGuard();

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "debug-api-route:debug-env",
      path: "app/api/debug-env/route.ts",
      line: 1,
    });
    expect(result.violations[0]?.excerpt).toBe("app/api/debug-env/route.ts");
  });

  it("flags any file (route + helper) under an app/api/debug-* directory", () => {
    writeFixture(
      "app/api/debug-foo/route.ts",
      'export async function GET() { return new Response("hi"); }',
    );
    writeFixture(
      "app/api/debug-foo/helpers.ts",
      'export function nothing() { return null; }',
    );

    const result = runGuard();

    const flaggedPaths = result.violations
      .filter((v) => v.rule === "debug-api-route:debug-foo")
      .map((v) => v.path)
      .sort();
    expect(flaggedPaths).toEqual([
      "app/api/debug-foo/helpers.ts",
      "app/api/debug-foo/route.ts",
    ]);
  });

  it("does not flag legitimate diagnostics or observability routes", () => {
    writeFixture(
      "app/api/diagnostics/health/route.ts",
      'export async function GET() { return new Response("ok"); }',
    );
    writeFixture(
      "app/api/observability/trace/route.ts",
      'export async function GET() { return new Response("ok"); }',
    );
    writeFixture(
      "app/api/debug.ts",
      'export const x = 1;',
    );

    const result = runGuard();

    expect(
      result.violations.filter((v) => v.rule.startsWith("debug-api-route:")),
    ).toEqual([]);
  });

  it("uses the package projection when running the public release guard", () => {
    writeFixture(
      "package.json",
      JSON.stringify(
        {
          name: "helm-console",
          private: true,
          license: "Apache-2.0",
          scripts: {
            dev: "next dev",
            [`seed:${tenantSlug}-workspace`]: `tsx ${tenantPrivateRoot}/scripts/seed-workspace.ts`,
          },
        },
        null,
        2,
      ),
    );

    const result = runGuard();

    expect(result.violations).toEqual([]);
    expect(result.publicPackageManifest?.manifest.private).toBe(false);
    expect(result.publicPackageManifest?.manifest.scripts).toEqual({
      "check:boundaries":
        "npm run public:smoke:static && npm run check:golden-path-docs && npm run check:source-profiler-boundaries && npm run check:diagnostics-risk && npm run check:llm-candidate-boundaries && npm run check:recoverable-agent-runtime && npm run check:agentic-sarp && npm run check:work-unit-governance && npm run check:ai-shelf-trust-center-contract && npm run check:stage1-owner-loop",
      "check:source-profiler-boundaries":
        "node --import tsx scripts/check-source-profiler-boundaries.ts",
      "check:golden-path-docs":
        "node --import tsx scripts/check-golden-path-docs.ts",
      "check:diagnostics-risk":
        "node --import tsx scripts/check-diagnostics-risk.ts",
      "check:llm-candidate-boundaries":
        "node --import tsx scripts/check-llm-candidate-boundaries.ts",
      "check:recoverable-agent-runtime":
        "node --import tsx scripts/check-recoverable-agent-runtime.ts",
      "check:agentic-sarp": "node --import tsx scripts/check-agentic-sarp.ts",
      "check:work-unit-governance":
        "node --import tsx scripts/check-work-unit-governance.ts",
      "check:ai-shelf-trust-center-contract":
        "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts",
      "check:stage1-owner-loop":
        "node --import tsx scripts/check-stage1-owner-loop.ts && vitest run lib/stage1-owner-loop features/dashboard/stage1-owner-loop-readout.test.ts features/dashboard/stage1-owner-loop-console-accessibility.test.ts --config vitest.public.config.ts",
      "sarp:proof": "node --import tsx scripts/sarp-proof.ts",
      "check:public-docs": "node --import tsx scripts/check-public-docs-curation.ts",
      "check:public-commit-metadata":
        "node --import tsx scripts/public-commit-metadata-check.ts",
      "check:bilingual-mixing":
        "node --import tsx scripts/lint-bilingual-mixing.ts",
      "check:bilingual-mixing:update":
        "node --import tsx scripts/lint-bilingual-mixing.ts --update-baseline",
      "check:public-release":
        "npm run check:public-docs && node --import tsx scripts/public-release-guard.ts",
      "db:prepare":
        "node -e \"console.log('public mirror: database prepare is not required')\"",
      dev: "next dev",
      e2e: "npm run public:e2e:smoke",
      "eval:llm-critic-boundaries":
        "vitest run lib/evals/llm-critic-evals.test.ts",
      "eval:llm-v2-boundaries":
        "vitest run lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts",
      "eval:llm-trajectory-harness": "vitest run lib/evals/llm-trajectory-harness.test.ts",
      "eval:llm-v3-boundaries":
        "vitest run lib/llm/intelligence-contracts-v3.test.ts lib/llm/reasoning-budget.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
      "eval:governed-runtime-contracts":
        "vitest run lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx scripts/check-llm-candidate-boundaries.test.ts --config vitest.public.config.ts",
      "eval:recoverable-agent-runtime":
        "vitest run lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts scripts/check-recoverable-agent-runtime.test.ts --config vitest.public.config.ts",
      "public:e2e:smoke": "npm run public:smoke:static",
      "public:smoke:static":
        "npm run check:public-docs && node --import tsx scripts/public-mirror-smoke.ts --repo-root .",
      "public:smoke": "node --import tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
      "quality:regression":
        "npm run test:public:guards && npm run public:smoke:static",
      "release:check": "node --import tsx scripts/release-readiness-check.ts",
      "self-check":
        "npm run public:smoke:static && npm run check:secret-history",
      test: "vitest run --config vitest.public.config.ts",
      "test:public:guards":
        "vitest run lib/public-release-guard.test.ts lib/public-mirror-semantic-entry-docs.test.ts scripts/check-llm-candidate-boundaries.test.ts scripts/check-recoverable-agent-runtime.test.ts scripts/check-agentic-sarp.test.ts scripts/check-work-unit-governance.test.ts lib/work-unit-governance/runtime.test.ts lib/work-unit-governance/mainline-ledger.test.ts features/work-unit-governance/work-unit-review-console.test.tsx features/work-unit-governance/work-unit-mainline-ledger-panel.test.tsx scripts/check-ai-shelf-trust-center-contract.test.ts scripts/sarp-proof.test.ts lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts lib/evals/llm-critic-evals.test.ts lib/llm/runtime-permission.test.ts lib/llm/overlay-context-hygiene.test.ts lib/llm/intelligence-contracts-v2.test.ts lib/llm/intelligence-contracts-v3.test.ts lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx lib/llm/reasoning-budget.test.ts lib/llm-workflows/review-counterfactual.workflow.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
      typecheck: "tsc --noEmit --project tsconfig.public.json",
    });
  });

  // Regression for the leak class CodeX flagged (head cdd0411): a tenant-named
  // Core helper shipped because the guard only matched content word-boundaries,
  // missing camelCase-embedded slugs and file PATHS. All slug text below is
  // fragment-built so the literal never appears in this scanned test file.
  describe("camelCase + path tenant-slug detection", () => {
    const slugB = ["mi", "dun"].join("");
    const slugCap = slugB.charAt(0).toUpperCase() + slugB.slice(1);

    it("flags a camelCase-embedded slug in CONTENT of a shipped Core file", () => {
      writeFixture("lib/notifications/daily.ts", `export function shouldSend${slugCap}Mail() {}\n`);
      const result = runGuard();
      expect(result.violations.some((v) => v.rule === `tenant-slug:${slugB}`)).toBe(true);
    });

    it("flags a tenant-named FILE PATH even when content is clean", () => {
      writeFixture(`lib/notifications/${slugB}-daily-mail-control.ts`, "export const x = 1;\n");
      const result = runGuard();
      expect(result.violations.some((v) => v.rule === `tenant-slug:${slugB}:path`)).toBe(true);
    });

    it("flags a camelCase slug embedded in a path segment", () => {
      writeFixture(`lib/${slugCap}Helper.ts`, "export const y = 2;\n");
      const result = runGuard();
      expect(result.violations.some((v) => v.rule === `tenant-slug:${slugB}:path`)).toBe(true);
    });

    it("does NOT false-positive on unrelated words or clean Core paths", () => {
      writeFixture("lib/notifications/system-mail.ts", "const medium = 1; const amidust = 2;\n");
      const result = runGuard();
      expect(result.violations.some((v) => v.rule.startsWith(`tenant-slug:${slugB}`))).toBe(false);
    });
  });
});
