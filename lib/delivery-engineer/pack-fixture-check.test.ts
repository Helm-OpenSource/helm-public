import path from "node:path";
import { describe, expect, it } from "vitest";

import { runPackFixtureCheck } from "./pack-fixture-check";

const ROOT = "/repo";
const PACK_PATH = "extensions/case-management-sample";

const validHsiManifest = {
  packId: "case-management-sample",
  displayName: "Case Management Sample",
  verticalKind: "case_management",
  sourceKinds: ["case_system", "im", "meeting", "email"],
  signalFamilies: [
    "commitment_missing",
    "stage_or_status_stale",
    "approval_blocked",
    "owner_mismatch",
    "duplicate_or_conflict",
    "boundary_attempt",
  ],
  reviewSurfaces: ["operating_signal_flow_map", "review_packet", "approval_inbox"],
  ownerRole: "delivery_engineering",
  dataPosture: "synthetic",
  redactionOwner: "delivery_engineer_side",
  nonProductionOnly: true,
  implementationChecklistRef: "extensions/case-management-sample/README.md",
};

function buildFileMap(overrides: Record<string, string | null> = {}) {
  const base: Record<string, string> = {
    [`${PACK_PATH}/README.md`]: "Case Management Sample",
    [`${PACK_PATH}/tenant.manifest.json`]: JSON.stringify({
      tenantKey: "case-management-sample",
      displayName: "Case Management Sample",
      ownedExtensions: [],
    }),
    [`${PACK_PATH}/hsi-pack.manifest.json`]: JSON.stringify(validHsiManifest),
    [`${PACK_PATH}/fixtures/case.sample.json`]: JSON.stringify([{ caseId: "CASE-SAMPLE-001" }]),
    [`${PACK_PATH}/fixtures/day-board.sample.json`]: JSON.stringify([{ day: "2026-05-20" }]),
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

function runWithFiles(files: Record<string, string>, packPath = PACK_PATH) {
  return runPackFixtureCheck({
    rootDir: ROOT,
    packPath,
    exists: (absolutePath) => {
      const relativePath = path.relative(ROOT, absolutePath);
      if (relativePath === `${PACK_PATH}/fixtures`) {
        return Object.keys(files).some((filePath) => filePath.startsWith(`${relativePath}/`));
      }
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
    listFiles: (absoluteDir) => {
      const relativeDir = path.relative(ROOT, absoluteDir);
      return Object.keys(files)
        .filter((filePath) => filePath.startsWith(`${relativeDir}/`))
        .map((filePath) => path.relative(relativeDir, filePath));
    },
  });
}

describe("runPackFixtureCheck", () => {
  it("passes a valid forkable sample pack", () => {
    const summary = runWithFiles(buildFileMap());

    expect(summary.passed).toBe(true);
    expect(summary.counts.fail).toBe(0);
    expect(summary.checks.find((check) => check.id === "hsi-manifest:validate")?.status).toBe(
      "pass",
    );
    expect(summary.checks.find((check) => check.id === "fixtures:json-files")?.detail).toContain(
      "2 fixture JSON",
    );
  });

  it("fails when the HSI manifest drops a required signal family", () => {
    const manifest = {
      ...validHsiManifest,
      signalFamilies: validHsiManifest.signalFamilies.filter(
        (family) => family !== "boundary_attempt",
      ),
    };
    const summary = runWithFiles(
      buildFileMap({ [`${PACK_PATH}/hsi-pack.manifest.json`]: JSON.stringify(manifest) }),
    );

    expect(summary.passed).toBe(false);
    expect(
      summary.checks.find((check) => check.id === "hsi-manifest:signal-family-coverage")?.detail,
    ).toContain("boundary_attempt");
  });

  it("fails when fixture JSON contains a generic credential marker", () => {
    const summary = runWithFiles(
      buildFileMap({
        [`${PACK_PATH}/fixtures/case.sample.json`]: JSON.stringify({
          accessKeyId: "AKIA000000000000",
        }),
      }),
    );

    expect(summary.passed).toBe(false);
    const markerCheck = summary.checks.find(
      (check) => check.id === "fixtures:credential-and-cloud-host-marker-scan",
    );
    expect(markerCheck?.status).toBe("fail");
    expect(markerCheck?.detail).toContain("aws_access_key_id");
  });

  it("catches the expanded marker set in fixture JSON", () => {
    const summary = runWithFiles(
      buildFileMap({
        [`${PACK_PATH}/fixtures/case.sample.json`]: JSON.stringify({
          slackToken: "xoxa-1234-abcdefghij",
          ghToken: "ghs_abcdefghijklmnopqrstuvwxyz0123456789",
          awsHost: "https://example.s3.amazonaws.com/key",
          jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturetail",
        }),
      }),
    );

    expect(summary.passed).toBe(false);
    const markerCheck = summary.checks.find(
      (check) => check.id === "fixtures:credential-and-cloud-host-marker-scan",
    );
    const detail = markerCheck?.detail ?? "";
    expect(detail).toContain("slack_token");
    expect(detail).toContain("github_token");
    expect(detail).toContain("aws_s3_host");
    expect(detail).toContain("jwt_header_payload");
  });

  it("fails when the pack path escapes the repo root", () => {
    const summary = runWithFiles(buildFileMap(), "../outside-pack");

    expect(summary.passed).toBe(false);
    expect(summary.checks).toHaveLength(1);
    expect(summary.checks[0]?.id).toBe("pack-path:inside-repo");
  });

  it("uses the minimum-review-surface check name and detail", () => {
    const summary = runWithFiles(buildFileMap());
    const check = summary.checks.find(
      (entry) => entry.id === "hsi-manifest:minimum-review-surfaces",
    );

    expect(check?.status).toBe("pass");
    expect(check?.title).toBe("minimum review surface coverage");
    expect(check?.detail).toContain("operating_signal_flow_map");
    expect(check?.detail).toContain("review_packet");
  });
});
