import path from "node:path";
import { describe, expect, it } from "vitest";
import { runDeliveryEngineerGoldenPathDoctor } from "./golden-path-doctor";

const ROOT = "/repo";

function buildFileMap(overrides: Record<string, string | null> = {}) {
  const scripts = {
    "delivery:doctor": "tsx scripts/delivery-engineer-doctor.ts",
    "pack:fixture-check": "tsx scripts/pack-fixture-check.ts",
    "eval:headless-signal-interface": "tsx scripts/headless-signal-interface-evals.ts",
    "eval:operating-signal-flow": "tsx scripts/operating-signal-flow-evals.ts",
    "check:public-release": "tsx scripts/public-release-guard.ts",
    "check:boundaries": "tsx scripts/decision-first-boundary-check.ts",
    "self-check": "tsx scripts/helm-self-check-refactored.ts",
  };

  const base: Record<string, string> = {
    "package.json": JSON.stringify({ scripts }),
    "README.md": "For delivery engineers",
    "docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md": "delivery engineers",
    "docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md": "Golden Path requirements",
    "docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md": "HSI",
    "docs/reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md": "closeout",
    "docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md": "D2 smoke pending",
    "extensions/case-management-sample/README.md": "sample",
    "extensions/case-management-sample/tenant.manifest.json": "{}",
    "extensions/case-management-sample/hsi-pack.manifest.json": "{}",
    "extensions/case-management-sample/fixtures/case.sample.json": "{}",
    "extensions/case-management-sample/signals/case/case-mapper.ts": "export {};",
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
  });
});
