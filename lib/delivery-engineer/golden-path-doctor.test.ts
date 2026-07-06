import path from "node:path";
import { describe, expect, it } from "vitest";
import { runDeliveryEngineerGoldenPathDoctor } from "./golden-path-doctor";

const ROOT = "/repo";

function helmEnvKey(...parts: readonly string[]) {
  return ["HELM", ...parts].join("_");
}

function buildFileMap(overrides: Record<string, string | null> = {}) {
  const scripts = {
    "delivery:doctor": "tsx scripts/delivery-engineer-doctor.ts",
    "golden:path": "node --import tsx scripts/golden-path-proof.ts",
    "pack:fixture-check": "tsx scripts/pack-fixture-check.ts",
    "eval:headless-signal-interface": "tsx scripts/headless-signal-interface-evals.ts",
    "eval:signal-first-mile-quality": "node templates/signal-first-mile/signal-quality-eval.js templates/signal-first-mile/signal-ledger.sample.json templates/signal-first-mile/signal-quality-goldens.sample.json",
    "eval:operating-signal-flow": "tsx scripts/operating-signal-flow-evals.ts",
    "check:public-release": "tsx scripts/public-release-guard.ts",
    "check:golden-path-docs": "node --import tsx scripts/check-golden-path-docs.ts",
    "check:boundaries": "tsx scripts/decision-first-boundary-check.ts",
    "self-check": "tsx scripts/helm-self-check-refactored.ts",
  };

  const base: Record<string, string> = {
    "package.json": JSON.stringify({ scripts }),
    ".env.example": [
      `${helmEnvKey("DEPLOYMENT", "REGION")}="global"`,
      `${helmEnvKey("DATA", "RESIDENCY")}="global"`,
      'HELM_DEFAULT_LOCALE="zh-CN"',
      'NPM_REGISTRY=""',
      'NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"',
      'DASHSCOPE_API_KEY=""',
      'DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"',
      'OPENAI_API_KEY=""',
      'LLM_DEFAULT_PROVIDER="qwen"',
      'LLM_ENABLED="false"',
      'ASR_ENABLED="false"',
      'ASR_OPENAI_MODEL="gpt-4o-mini-transcribe"',
      'CONNECTOR_TOKEN_SECRET="public-local-connector-token-secret-000000000000"',
    ].join("\n"),
    "README.md": "For delivery engineers",
    "docs/getting-started.md": "NPM_REGISTRY registry-mirrors",
    "docs/getting-started.en.md": "NPM_REGISTRY registry-mirrors",
    "docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md": "delivery engineers",
    "docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md": "Golden Path requirements",
    "docs/product/HELM_DELIVERY_ENGINEER_SETUP_DIAGNOSTIC_REQUIREMENTS.md": "Setup diagnostic requirements L0 L1 L2 source intake proof package forbidden actions read-only local static check no writeback no external send no approval execution no official memory promotion no customer deployment proof",
    "docs/product/HELM_DATA_INTAKE_EXPERIENCE.md": "Helm data intake L0 diagnostic material L1 redacted fixture L2 read-only access forbidden actions no writeback external send approval execution hosted ingest endpoint customer deployment proof",
    "docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md": "HSI",
    "docs/reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md": "closeout",
    "docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md": "D2 smoke pending",
    "features/settings/data-intake-ux.ts": "L0 L1 L2 SourceIntakeOption forbiddenAction no writeback external send approval execution customer deployment proof",
    "scripts/golden-path-proof.ts": "DEFAULT_GOLDEN_PATH_PROOF_OUTPUT /tmp/helm-golden-path-proof MANIFEST.json source-profiler-receipt.json",
    "scripts/check-golden-path-docs.ts": "npm run golden:path /tmp/helm-golden-path-proof",
    "templates/signal-first-mile/run-first-change-proof.js": "evalCommand MANIFEST.json customer-materials.md signal-quality-report.md hsi-fixture.json review-packet.md",
    "templates/signal-first-mile/selector-input.sample.json": "{}",
    "templates/signal-first-mile/signal-quality-eval.js": "module.exports = {};",
    "extensions/case-management-sample/README.md": "sample",
    "extensions/case-management-sample/tenant.manifest.json": "{}",
    "extensions/case-management-sample/hsi-pack.manifest.json": "{}",
    "extensions/case-management-sample/fixtures/case.sample.json": "{}",
    "extensions/case-management-sample/signals/case/case-mapper.ts": "export {};",
    "extensions/case-management-sample/signals/review-packet.ts": "export {};",
    "extensions/case-management-sample/workers/case-allocation-driver/decide.ts": "export {};",
    "extensions/case-management-sample/workers/case-stewardship-driver/decide.ts": "export {};",
    "lib/headless-signal-interface/pack-manifest.ts": "export {};",
    "lib/headless-signal-interface/facade-types.ts": "export {};",
    "evals/headless-signal-interface/headless-signal-interface-cases.json": "{}",
    "lib/evals/headless-signal-interface-evals.ts": "export {};",
    "scripts/headless-signal-interface-evals.ts": "export {};",
    "lib/delivery-engineer/pack-fixture-check.ts": "export {};",
    "scripts/pack-fixture-check.ts": "export {};",
    "extensions/case-management-sample/signals/types.test.ts": "test",
    "extensions/case-management-sample/signals/case/case-mapper.test.ts": "test",
    "extensions/case-management-sample/workers/manifest.test.ts": "test",
    "extensions/case-management-sample/workers/worker-modes.test.ts": "test",
    "extensions/case-management-sample/workers/lifecycle-objectives.test.ts": "test",
    "extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts": "test",
    "extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts": "test",
    "extensions/case-management-sample/bi-report/manifest.test.ts": "test",
    "docker-compose.yml": "services: {}",
    "docs/reviews/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_CLOSEOUT.md": "closeout",
  };

  for (const [relativePath, content] of Object.entries(overrides)) {
    if (content === null) {
      delete base[relativePath];
    } else {
      base[relativePath] = content;
    }
  }

  return base;
}

function runWithFiles(
  files: Record<string, string>,
  directoryEntries: Record<string, readonly string[]> = {},
) {
  return runDeliveryEngineerGoldenPathDoctor({
    rootDir: ROOT,
    exists: (absolutePath) => {
      const relativePath = path.relative(ROOT, absolutePath);
      return Object.prototype.hasOwnProperty.call(files, relativePath);
    },
    readFile: (absolutePath) => {
      const relativePath = path.relative(ROOT, absolutePath);
      const content = files[relativePath];
      if (content === undefined) {
        throw new Error(`missing fixture file ${relativePath}`);
      }
      return content;
    },
    listDirectory: (absoluteDir) => {
      const relativeDir = path.relative(ROOT, absoluteDir);
      return directoryEntries[relativeDir] ?? [];
    },
  });
}

describe("runDeliveryEngineerGoldenPathDoctor", () => {
  it("passes when the Golden Path files and scripts are present", () => {
    const summary = runWithFiles(buildFileMap());

    expect(summary.passed).toBe(true);
    expect(summary.counts.fail).toBe(0);
    expect(summary.checks.find((check) => check.id === "script:delivery:doctor")?.status).toBe(
      "pass",
    );
    expect(
      summary.checks.find(
        (check) => check.id === "case-management-sample:credential-and-cloud-host-marker-scan",
      )?.status,
    ).toBe("pass");
    expect(summary.nextCommands).toContain("npm run eval:headless-signal-interface");
    expect(summary.nextCommands).toContain("npm run golden:path");
    expect(summary.nextCommands).toContain("npm run delivery:doctor -- --region cn");
  });

  it("checks source-intake static assets without reading generated proof output", () => {
    const summary = runWithFiles(buildFileMap());

    expect(summary.boundary).toBe("read_only_local_repo_static_check");
    expect(
      summary.checks.find((check) => check.id === "source-intake:setup-diagnostic-doc")
        ?.status,
    ).toBe("pass");
    expect(
      summary.checks.find((check) => check.id === "source-intake:proof-package-static-assets")
        ?.status,
    ).toBe("pass");
    expect(
      summary.checks.find((check) => check.id === "source-intake:l0-l1-l2-contract")
        ?.status,
    ).toBe("pass");
    expect(
      summary.checks.find((check) => check.id === "source-intake:forbidden-action-boundary")
        ?.status,
    ).toBe("pass");
    expect(summary.nextCommands).toContain(
      "node templates/signal-first-mile/run-first-change-proof.js templates/signal-first-mile/selector-input.sample.json /tmp/helm-sfm-first-change-proof",
    );
    expect(summary.nextCommands).toContain("npm run eval:signal-first-mile-quality");
    expect(summary.checks.map((check) => `${check.id} ${check.detail}`).join("\n")).not.toContain(
      "/tmp/helm-sfm-first-change-proof",
    );
  });

  it("fails source-intake checks when L0/L1/L2 or forbidden boundaries drift", () => {
    const summary = runWithFiles(
      buildFileMap({
        "docs/product/HELM_DATA_INTAKE_EXPERIENCE.md": "connector setup only",
        "features/settings/data-intake-ux.ts": "connector setup only",
      }),
    );

    expect(summary.passed).toBe(false);
    expect(
      summary.checks.find((check) => check.id === "source-intake:l0-l1-l2-contract")?.status,
    ).toBe("fail");
    expect(
      summary.checks.find((check) => check.id === "source-intake:forbidden-action-boundary")
        ?.status,
    ).toBe("fail");
  });

  it("fails when a required script is missing", () => {
    const packageJson = JSON.stringify({
      scripts: {
        "delivery:doctor": "tsx scripts/delivery-engineer-doctor.ts",
      },
    });

    const summary = runWithFiles(buildFileMap({ "package.json": packageJson }));

    expect(summary.passed).toBe(false);
    expect(summary.checks.find((check) => check.id === "script:check:boundaries")?.status).toBe(
      "fail",
    );
  });

  it("fails when sample files contain generic credential markers", () => {
    const summary = runWithFiles(
      buildFileMap({
        "extensions/case-management-sample/fixtures/case.sample.json": JSON.stringify({
          accessKeyId: "AKIA000000000000",
        }),
      }),
    );

    expect(summary.passed).toBe(false);
    const markerCheck = summary.checks.find(
      (check) => check.id === "case-management-sample:credential-and-cloud-host-marker-scan",
    );
    expect(markerCheck?.status).toBe("fail");
    expect(markerCheck?.detail).toContain("aws_access_key_id");
  });

  it("fires the expanded marker set (GitHub / Slack / Azure / Tencent / JWT)", () => {
    const summary = runWithFiles(
      buildFileMap({
        "extensions/case-management-sample/fixtures/case.sample.json": JSON.stringify({
          githubToken: "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
          slackToken: "xoxb-12345678-deadbeefcafe",
          azureHost: "https://example.blob.core.windows.net/data",
          tencentHost: "https://example.cos.ap-shanghai.myqcloud.com/data",
        }),
      }),
    );

    expect(summary.passed).toBe(false);
    const markerCheck = summary.checks.find(
      (check) => check.id === "case-management-sample:credential-and-cloud-host-marker-scan",
    );
    expect(markerCheck?.status).toBe("fail");
    const detail = markerCheck?.detail ?? "";
    expect(detail).toContain("github_token");
    expect(detail).toContain("slack_token");
    expect(detail).toContain("azure_blob_host");
    expect(detail).toContain("tencent_cos_host");
  });

  it("matches D2 smoke receipt by filename pattern, not by a single literal name", () => {
    const summary = runWithFiles(buildFileMap(), {
      "docs/reviews": ["HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-07-01.md"],
    });

    expect(
      summary.checks.find((check) => check.id === "fresh-clone:d2-smoke-receipt")?.status,
    ).toBe("pass");
    expect(summary.counts.warn).toBe(0);
  });

  it("reports the boundary string in the aligned read_only_<scope>_static_check shape", () => {
    const summary = runWithFiles(buildFileMap());
    expect(summary.boundary).toBe("read_only_local_repo_static_check");
    expect(summary.regionProfile).toBe("global");
  });

  it("warns when Qwen is enabled but only OPENAI_API_KEY is configured", () => {
    const summary = runWithFiles(
      buildFileMap({
        ".env": [
          'LLM_ENABLED="true"',
          'LLM_DEFAULT_PROVIDER="qwen"',
          'OPENAI_API_KEY="sk-test-only"',
          'DASHSCOPE_API_KEY=""',
        ].join("\n"),
      }),
    );

    const check = summary.checks.find((item) => item.id === "config:qwen-dashscope-key");
    expect(summary.passed).toBe(true);
    expect(check?.status).toBe("warn");
    expect(check?.detail).toContain("only OPENAI_API_KEY is present");
  });

  it("surfaces China-profile env and ASR warnings without failing the static doctor", () => {
    const summary = runDeliveryEngineerGoldenPathDoctor({
      rootDir: ROOT,
      regionProfile: "cn",
      env: {},
      exists: (absolutePath) => {
        const relativePath = path.relative(ROOT, absolutePath);
        return Object.prototype.hasOwnProperty.call(
          buildFileMap({
            ".env": [
              'HELM_DEPLOYMENT_REGION="global"',
              'HELM_DATA_RESIDENCY="global"',
              'ASR_ENABLED="true"',
            ].join("\n"),
          }),
          relativePath,
        );
      },
      readFile: (absolutePath) => {
        const relativePath = path.relative(ROOT, absolutePath);
        const files = buildFileMap({
          ".env": [
            'HELM_DEPLOYMENT_REGION="global"',
            'HELM_DATA_RESIDENCY="global"',
            'ASR_ENABLED="true"',
          ].join("\n"),
        });
        const content = files[relativePath];
        if (content === undefined) {
          throw new Error(`missing fixture file ${relativePath}`);
        }
        return content;
      },
      listDirectory: () => [],
    });

    expect(summary.passed).toBe(true);
    expect(summary.regionProfile).toBe("cn");
    expect(summary.checks.find((item) => item.id === "config:china-region-residency")?.status).toBe(
      "warn",
    );
    expect(summary.checks.find((item) => item.id === "network:china-npm-registry")?.status).toBe(
      "warn",
    );
    expect(summary.checks.find((item) => item.id === "config:asr-openai-china-boundary")?.status).toBe(
      "warn",
    );
  });

  it("passes China-profile checks when local China delivery hints are configured", () => {
    const summary = runDeliveryEngineerGoldenPathDoctor({
      rootDir: ROOT,
      regionProfile: "cn",
      env: {},
      exists: (absolutePath) => {
        const relativePath = path.relative(ROOT, absolutePath);
        return Object.prototype.hasOwnProperty.call(
          buildFileMap({
            ".env": [
              'HELM_DEPLOYMENT_REGION="cn"',
              'HELM_DATA_RESIDENCY="cn"',
              'NPM_REGISTRY="https://registry.npmmirror.com"',
              'ASR_ENABLED="false"',
            ].join("\n"),
          }),
          relativePath,
        );
      },
      readFile: (absolutePath) => {
        const relativePath = path.relative(ROOT, absolutePath);
        const files = buildFileMap({
          ".env": [
            'HELM_DEPLOYMENT_REGION="cn"',
            'HELM_DATA_RESIDENCY="cn"',
            'NPM_REGISTRY="https://registry.npmmirror.com"',
            'ASR_ENABLED="false"',
          ].join("\n"),
        });
        const content = files[relativePath];
        if (content === undefined) {
          throw new Error(`missing fixture file ${relativePath}`);
        }
        return content;
      },
      listDirectory: () => [],
    });

    expect(summary.checks.find((item) => item.id === "config:china-region-residency")?.status).toBe(
      "pass",
    );
    expect(summary.checks.find((item) => item.id === "network:china-npm-registry")?.status).toBe(
      "pass",
    );
    expect(summary.checks.find((item) => item.id === "config:asr-openai-china-boundary")?.status).toBe(
      "pass",
    );
  });

  it("passes the China ASR boundary when the dashscope provider is configured", () => {
    const envFile = [
      'HELM_DEPLOYMENT_REGION="cn"',
      'HELM_DATA_RESIDENCY="cn"',
      'NPM_REGISTRY="https://registry.npmmirror.com"',
      'ASR_ENABLED="true"',
      'ASR_PROVIDER="dashscope"',
      'DASHSCOPE_API_KEY="synthetic-test-key"',
    ].join("\n");
    const summary = runDeliveryEngineerGoldenPathDoctor({
      rootDir: ROOT,
      regionProfile: "cn",
      env: {},
      exists: (absolutePath) => {
        const relativePath = path.relative(ROOT, absolutePath);
        return Object.prototype.hasOwnProperty.call(
          buildFileMap({ ".env": envFile }),
          relativePath,
        );
      },
      readFile: (absolutePath) => {
        const relativePath = path.relative(ROOT, absolutePath);
        const files = buildFileMap({ ".env": envFile });
        const content = files[relativePath];
        if (content === undefined) {
          throw new Error(`missing fixture file ${relativePath}`);
        }
        return content;
      },
      listDirectory: () => [],
    });

    const check = summary.checks.find(
      (item) => item.id === "config:asr-openai-china-boundary",
    );
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("dashscope");
  });

  it("keeps the China delivery profile and OpenAI-only ASR precheck visible", () => {
    const summary = runWithFiles(buildFileMap());

    expect(
      summary.checks.find((check) => check.id === "china-profile:public-env-defaults")?.status,
    ).toBe("pass");
    expect(
      summary.checks.find((check) => check.id === "asr:openai-only-precheck")?.status,
    ).toBe("pass");
    expect(
      summary.checks.find((check) => check.id === "connector-token:minimal-secret-placeholder")
        ?.status,
    ).toBe("pass");
  });

  it("fails when ASR is configured as a Qwen or generic provider path", () => {
    const summary = runWithFiles(
      buildFileMap({
        ".env.example": [
          `${helmEnvKey("DEPLOYMENT", "REGION")}="global"`,
          `${helmEnvKey("DATA", "RESIDENCY")}="global"`,
          'NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"',
          'DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"',
          'LLM_DEFAULT_PROVIDER="qwen"',
          'ASR_PROVIDER="qwen"',
          'ASR_ENABLED="true"',
          'ASR_OPENAI_MODEL=""',
          'OPENAI_API_KEY=""',
          'CONNECTOR_TOKEN_SECRET="public-local-connector-token-secret-000000000000"',
        ].join("\n"),
      }),
    );

    const check = summary.checks.find((entry) => entry.id === "asr:openai-only-precheck");
    expect(summary.passed).toBe(false);
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("ASR_PROVIDER");
    expect(check?.detail).toContain("ASR_OPENAI_MODEL");
  });
});
