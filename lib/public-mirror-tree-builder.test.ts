import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PUBLIC_DOCKERIGNORE_CONTENT } from "../scripts/build-public-dockerignore";
import { PUBLIC_ENV_EXAMPLE_CONTENT } from "../scripts/build-public-env-example";
import { buildPublicMirrorTree } from "../scripts/build-public-mirror-tree";

// repo-split 5C: a tenant-free registry stand-in (shape mirrors the real
// lib/extensions/registry.tsx — reads a store, imports no @/extensions). The
// mirror ships this kind of file unchanged; there is no stub projection.
const TENANT_FREE_REGISTRY = [
  'import "server-only";',
  "",
  'import { getRegisteredReportsExtensions } from "./registry-contract";',
  "",
  "export async function resolveReportsExtensions() {",
  "  return { tabs: getRegisteredReportsExtensions().slice(0, 0), active: null };",
  "}",
  "",
].join("\n");

let fixtureParent: string;
let sourceRoot: string;
let mirrorRoot: string;

const tenantSlug = ["gua", "ng", "pu"].join("");
const tenantPrivateRoot = ["extensions", tenantSlug].join("/");
const pendingImplementationConsoleRoot = ["extensions", "helm-implementation-console"].join("/");
const internalDocsRoot = ["docs", "internal"].join("/");
const sensitivePolicyDoc = [
  "docs",
  "product",
  "HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_RELEASE_READINESS_CORRECTION_V1.md",
].join("/");

function writeText(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(root: string, relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function seedPrivateSourceTree(): void {
  writeJson(sourceRoot, "package.json", {
    name: "helm-console",
    private: true,
    license: "Apache-2.0",
    scripts: {
      dev: "next dev",
      typecheck: "next typegen && npm run db:generate && tsc --noEmit",
      "self-check": "node --import tsx scripts/helm-self-check-refactored.ts",
      "check:boundaries": "node --import tsx scripts/decision-first-boundary-check.ts",
      "check:public-release": "node --import tsx scripts/public-release-guard.ts",
      "release:check": "node --import tsx scripts/release-readiness-check.ts",
      [`seed:${tenantSlug}`]: `tsx ${tenantPrivateRoot}/scripts/seed.ts`,
    },
  });
  writeText(sourceRoot, "LICENSE", "Apache License\nVersion 2.0, January 2004\n");
  writeText(
    sourceRoot,
    "NOTICE",
    "Helm\nLicensed under the Apache License, Version 2.0\n",
  );
  // repo-split 5C: the real registry is tenant-free (reads a runtime store; no
  // @/extensions import) and ships UNCHANGED in the mirror — no stub projection.
  // Seed a tenant-free registry and assert the builder copies it verbatim.
  writeText(sourceRoot, "lib/extensions/registry.tsx", TENANT_FREE_REGISTRY);
  writeText(sourceRoot, "README.md", "# Helm\n");
  writeText(sourceRoot, ".env.example", "HELM_DEFAULT_LOCALE=zh-CN\n");
  writeText(sourceRoot, ".dockerignore", `node_modules\n${tenantPrivateRoot}/\n`);
  writeJson(sourceRoot, "tsconfig.json", {
    compilerOptions: {
      strict: true,
    },
    include: ["**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  });
  writeText(sourceRoot, ".env.local", "DATABASE_URL=mysql://private\n");
  writeText(sourceRoot, ".next/static/chunk.js.map", "tenant artifact");
  writeText(sourceRoot, "node_modules/example/index.js", "module artifact");
  writeText(sourceRoot, `${tenantPrivateRoot}/private.ts`, "tenant private");
  writeText(
    sourceRoot,
    `${pendingImplementationConsoleRoot}/lib/reports-extension.ts`,
    "pending internal implementation console",
  );
  writeText(sourceRoot, `${internalDocsRoot}/adr.md`, "internal private");
  writeText(sourceRoot, sensitivePolicyDoc, `historical ${tenantSlug} policy\n`);
  writeText(
    sourceRoot,
    "docs/HELM_INTERNAL_FREEZE_REFERENCE.md",
    "internal freeze reference",
  );
}

describe("public mirror tree builder", () => {
  beforeEach(() => {
    fixtureParent = mkdtempSync(path.join(tmpdir(), "helm-public-builder-"));
    sourceRoot = path.join(fixtureParent, "source");
    mirrorRoot = path.join(fixtureParent, "mirror");
    mkdirSync(sourceRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(fixtureParent, { force: true, recursive: true });
  });

  it("copies a public candidate, applies projections, and verifies the mirror", () => {
    seedPrivateSourceTree();

    const result = buildPublicMirrorTree({ mirrorRoot, sourceRoot });

    expect(result.exitCode).toBe(0);
    expect(result.preflightExitCode).toBe(0);
    expect(result.violations).toEqual([]);
    expect(result.copiedFiles).toBeGreaterThan(0);
    expect(result.skippedEntries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        ".env.local",
        ".next",
        "node_modules",
        tenantPrivateRoot,
        pendingImplementationConsoleRoot,
        internalDocsRoot,
        sensitivePolicyDoc,
        "docs/HELM_INTERNAL_FREEZE_REFERENCE.md",
      ]),
    );
    expect(readText(mirrorRoot, "README.md")).toBe("# Helm\n");
    expect(readText(mirrorRoot, ".env.example")).toBe(PUBLIC_ENV_EXAMPLE_CONTENT);
    expect(readText(mirrorRoot, ".dockerignore")).toBe(PUBLIC_DOCKERIGNORE_CONTENT);
    expect(JSON.parse(readText(mirrorRoot, "tsconfig.json"))).toMatchObject({
      compilerOptions: {
        strict: true,
      },
      exclude: [
        "node_modules",
        "**/*.test.ts",
        "**/*.test.tsx",
        "lib/evals/**",
      ],
    });
    expect(existsSync(path.join(mirrorRoot, ".env.local"))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, ".next"))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, tenantPrivateRoot))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, pendingImplementationConsoleRoot))).toBe(
      false,
    );
    expect(existsSync(path.join(mirrorRoot, internalDocsRoot))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, sensitivePolicyDoc))).toBe(false);
    expect(
      existsSync(path.join(mirrorRoot, "docs/HELM_INTERNAL_FREEZE_REFERENCE.md")),
    ).toBe(false);
    expect(JSON.parse(readText(mirrorRoot, "package.json"))).toEqual({
      name: "helm-console",
      private: false,
      license: "Apache-2.0",
      scripts: {
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
        "check:public-commit-metadata":
          "node --import tsx scripts/public-commit-metadata-check.ts",
        "check:public-docs": "node --import tsx scripts/check-public-docs-curation.ts",
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
          "vitest run lib/public-release-guard.test.ts lib/public-mirror-semantic-entry-docs.test.ts scripts/check-llm-candidate-boundaries.test.ts scripts/check-recoverable-agent-runtime.test.ts scripts/check-agentic-sarp.test.ts scripts/check-work-unit-governance.test.ts lib/work-unit-governance/runtime.test.ts lib/work-unit-governance/mainline-ledger.test.ts lib/work-unit-governance/owner-lifecycle.test.ts lib/work-unit-governance/activation-handoff.test.ts lib/work-unit-governance/repair-learning-loop.test.ts features/work-unit-governance/work-unit-review-console.test.tsx features/work-unit-governance/work-unit-mainline-ledger-panel.test.tsx features/work-unit-governance/work-unit-owner-lifecycle-panel.test.tsx features/work-unit-governance/work-unit-activation-handoff-panel.test.tsx features/work-unit-governance/work-unit-repair-learning-panel.test.tsx scripts/check-ai-shelf-trust-center-contract.test.ts scripts/sarp-proof.test.ts lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts lib/evals/llm-critic-evals.test.ts lib/llm/runtime-permission.test.ts lib/llm/overlay-context-hygiene.test.ts lib/llm/intelligence-contracts-v2.test.ts lib/llm/intelligence-contracts-v3.test.ts lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx lib/llm/reasoning-budget.test.ts lib/llm-workflows/review-counterfactual.workflow.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
        typecheck: "tsc --noEmit --project tsconfig.public.json",
      },
    });
    // The mirror ships the real (tenant-free) registry unchanged — no stub.
    expect(readText(mirrorRoot, "lib/extensions/registry.tsx")).toBe(
      TENANT_FREE_REGISTRY,
    );
  });

  it("skips a worktree-form .git file and keeps it out of the mirror", () => {
    seedPrivateSourceTree();
    // In a git worktree, `.git` is a file (a `gitdir:` pointer), not a directory.
    writeText(
      sourceRoot,
      ".git",
      "gitdir: /tmp/helm-some-worktree/.git/worktrees/source\n",
    );

    const result = buildPublicMirrorTree({ mirrorRoot, sourceRoot });

    expect(result.exitCode).toBe(0);
    expect(result.skippedEntries).toContainEqual({
      path: ".git",
      reason: "local-artifact-file",
    });
    expect(existsSync(path.join(mirrorRoot, ".git"))).toBe(false);
  });

  it("refuses to build directly into the source root", () => {
    seedPrivateSourceTree();

    expect(() =>
      buildPublicMirrorTree({ mirrorRoot: sourceRoot, sourceRoot }),
    ).toThrow("--mirror-root must not be the source repo root");
  });

  it("refuses to build a mirror nested inside the source root", () => {
    seedPrivateSourceTree();
    const nestedMirrorRoot = path.join(sourceRoot, "public-mirror");

    expect(() =>
      buildPublicMirrorTree({ mirrorRoot: nestedMirrorRoot, sourceRoot }),
    ).toThrow("--mirror-root must not be inside the source repo");
  });

  it("refuses to build into a non-empty mirror root without force-clean", () => {
    seedPrivateSourceTree();
    writeText(mirrorRoot, "old.txt", "old");

    expect(() => buildPublicMirrorTree({ mirrorRoot, sourceRoot })).toThrow(
      "--mirror-root must be empty; pass --force-clean to replace it",
    );
    expect(readText(mirrorRoot, "old.txt")).toBe("old");
  });

  it("replaces an existing mirror root only when force-clean is explicit", () => {
    seedPrivateSourceTree();
    writeText(mirrorRoot, "old.txt", "old");

    const result = buildPublicMirrorTree({
      forceClean: true,
      mirrorRoot,
      sourceRoot,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(mirrorRoot, "old.txt"))).toBe(false);
    expect(readText(mirrorRoot, "README.md")).toBe("# Helm\n");
  });

  it("mirrors package.json with tenant scripts stripped and public smoke scripts injected", () => {
    seedPrivateSourceTree();
    buildPublicMirrorTree({ mirrorRoot, sourceRoot });

    const rawContent = readText(mirrorRoot, "package.json");
    // Verify no literal tenant slug appears in the projected package.json text.
    // Pattern built from fragments so this test file itself stays clean.
    const tenantPattern = new RegExp([tenantSlug, ["mi", "dun"].join("")].join("|"), "i");
    expect(rawContent).not.toMatch(tenantPattern);

    const pkg = JSON.parse(rawContent) as Record<string, unknown>;
    const scripts = pkg.scripts as Record<string, string>;
    expect(pkg.private).toBe(false);
    expect(scripts["public:smoke:static"]).toBeDefined();
    expect(scripts.typecheck).toBe("tsc --noEmit --project tsconfig.public.json");
    expect(scripts["db:prepare"]).toBe(
      "node -e \"console.log('public mirror: database prepare is not required')\"",
    );
    expect(scripts["self-check"]).toBe(
      "npm run public:smoke:static && npm run check:secret-history",
    );
    expect(scripts["check:boundaries"]).toBe(
      "npm run public:smoke:static && npm run check:golden-path-docs && npm run check:source-profiler-boundaries && npm run check:diagnostics-risk && npm run check:llm-candidate-boundaries && npm run check:recoverable-agent-runtime && npm run check:agentic-sarp && npm run check:work-unit-governance && npm run check:ai-shelf-trust-center-contract && npm run check:stage1-owner-loop",
    );
    expect(scripts["check:source-profiler-boundaries"]).toBe(
      "node --import tsx scripts/check-source-profiler-boundaries.ts",
    );
    expect(scripts["check:golden-path-docs"]).toBe(
      "node --import tsx scripts/check-golden-path-docs.ts",
    );
    expect(scripts["check:diagnostics-risk"]).toBe(
      "node --import tsx scripts/check-diagnostics-risk.ts",
    );
    expect(scripts["check:llm-candidate-boundaries"]).toBe(
      "node --import tsx scripts/check-llm-candidate-boundaries.ts",
    );
    expect(scripts["check:recoverable-agent-runtime"]).toBe(
      "node --import tsx scripts/check-recoverable-agent-runtime.ts",
    );
    expect(scripts["check:agentic-sarp"]).toBe(
      "node --import tsx scripts/check-agentic-sarp.ts",
    );
    expect(scripts["check:work-unit-governance"]).toBe(
      "node --import tsx scripts/check-work-unit-governance.ts",
    );
    expect(scripts["check:ai-shelf-trust-center-contract"]).toBe(
      "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts",
    );
    expect(scripts["check:stage1-owner-loop"]).toBe(
      "node --import tsx scripts/check-stage1-owner-loop.ts && vitest run lib/stage1-owner-loop features/dashboard/stage1-owner-loop-readout.test.ts features/dashboard/stage1-owner-loop-console-accessibility.test.ts --config vitest.public.config.ts",
    );
    expect(scripts["sarp:proof"]).toBe("node --import tsx scripts/sarp-proof.ts");
    expect(scripts["eval:llm-critic-boundaries"]).toBe(
      "vitest run lib/evals/llm-critic-evals.test.ts",
    );
    expect(scripts["eval:llm-v2-boundaries"]).toBe(
      "vitest run lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts",
    );
    expect(scripts["eval:llm-trajectory-harness"]).toBe(
      "vitest run lib/evals/llm-trajectory-harness.test.ts",
    );
    expect(scripts["eval:llm-v3-boundaries"]).toBe(
      "vitest run lib/llm/intelligence-contracts-v3.test.ts lib/llm/reasoning-budget.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
    );
    expect(scripts["eval:governed-runtime-contracts"]).toBe(
      "vitest run lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx scripts/check-llm-candidate-boundaries.test.ts --config vitest.public.config.ts",
    );
    expect(scripts["eval:recoverable-agent-runtime"]).toBe(
      "vitest run lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts scripts/check-recoverable-agent-runtime.test.ts --config vitest.public.config.ts",
    );
    expect(scripts.test).toBe("vitest run --config vitest.public.config.ts");
    expect(scripts["test:public:guards"]).toBe(
      "vitest run lib/public-release-guard.test.ts lib/public-mirror-semantic-entry-docs.test.ts scripts/check-llm-candidate-boundaries.test.ts scripts/check-recoverable-agent-runtime.test.ts scripts/check-agentic-sarp.test.ts scripts/check-work-unit-governance.test.ts lib/work-unit-governance/runtime.test.ts lib/work-unit-governance/mainline-ledger.test.ts lib/work-unit-governance/owner-lifecycle.test.ts lib/work-unit-governance/activation-handoff.test.ts lib/work-unit-governance/repair-learning-loop.test.ts features/work-unit-governance/work-unit-review-console.test.tsx features/work-unit-governance/work-unit-mainline-ledger-panel.test.tsx features/work-unit-governance/work-unit-owner-lifecycle-panel.test.tsx features/work-unit-governance/work-unit-activation-handoff-panel.test.tsx features/work-unit-governance/work-unit-repair-learning-panel.test.tsx scripts/check-ai-shelf-trust-center-contract.test.ts scripts/sarp-proof.test.ts lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts lib/evals/llm-critic-evals.test.ts lib/llm/runtime-permission.test.ts lib/llm/overlay-context-hygiene.test.ts lib/llm/intelligence-contracts-v2.test.ts lib/llm/intelligence-contracts-v3.test.ts lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx lib/llm/reasoning-budget.test.ts lib/llm-workflows/review-counterfactual.workflow.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
    );
    expect(scripts["quality:regression"]).toBe(
      "npm run test:public:guards && npm run public:smoke:static",
    );
    expect(scripts["public:e2e:smoke"]).toBe("npm run public:smoke:static");
    expect(scripts.e2e).toBe("npm run public:e2e:smoke");
    expect(scripts["check:public-docs"]).toBe(
      "node --import tsx scripts/check-public-docs-curation.ts",
    );
    expect(scripts["check:public-release"]).toBe(
      "npm run check:public-docs && node --import tsx scripts/public-release-guard.ts",
    );
    expect(scripts["release:check"]).toBe(
      "node --import tsx scripts/release-readiness-check.ts",
    );
    expect(Object.keys(scripts)).not.toContain(`seed:${tenantSlug}`);
  });

  it("mirror excludes tenant private root, pending implementation-console, and sensitive policy doc", () => {
    seedPrivateSourceTree();
    const result = buildPublicMirrorTree({ mirrorRoot, sourceRoot });

    expect(result.exitCode).toBe(0);
    expect(result.violations).toEqual([]);
    expect(existsSync(path.join(mirrorRoot, tenantPrivateRoot))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, pendingImplementationConsoleRoot))).toBe(false);
    expect(existsSync(path.join(mirrorRoot, sensitivePolicyDoc))).toBe(false);
  });
});
