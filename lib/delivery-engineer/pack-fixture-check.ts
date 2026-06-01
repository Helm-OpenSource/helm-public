import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  HSI_SIGNAL_FAMILIES,
  NON_SALESFORCE_SOURCE_KINDS,
  validateHsiPackManifest,
  type HsiPackManifest,
} from "@/lib/headless-signal-interface/pack-manifest";
import { scanForSensitiveMarkers } from "./sensitive-markers";

export type PackFixtureCheckStatus = "pass" | "warn" | "fail";

export type PackFixtureCheck = {
  id: string;
  title: string;
  status: PackFixtureCheckStatus;
  detail: string;
  nextAction?: string;
};

export type PackFixtureCheckSummary = {
  version: "delivery_engineer_pack_fixture_check_v1";
  boundary: "read_only_pack_fixture_static_check";
  packPath: string;
  passed: boolean;
  counts: Record<PackFixtureCheckStatus, number>;
  checks: PackFixtureCheck[];
  nextCommands: string[];
};

type FileExists = (absolutePath: string) => boolean;
type FileReader = (absolutePath: string) => string;
type FileLister = (absoluteDir: string) => readonly string[];

export type RunPackFixtureCheckOptions = {
  rootDir?: string;
  packPath?: string;
  exists?: FileExists;
  readFile?: FileReader;
  listFiles?: FileLister;
};

type JsonParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type TenantManifest = {
  tenantKey?: string;
  displayName?: string;
  ownedExtensions?: readonly unknown[];
};

const DEFAULT_PACK_PATH = "extensions/case-management-sample";

const REQUIRED_PACK_FILES = [
  "README.md",
  "tenant.manifest.json",
  "hsi-pack.manifest.json",
] as const;

function defaultReadFile(absolutePath: string) {
  return readFileSync(absolutePath, "utf8");
}

function defaultListFiles(absoluteDir: string) {
  const files: string[] = [];

  function walk(currentDir: string, relativePrefix: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      // Hard-skip symlinks: a fixture-side symlink to /etc or to an
      // arbitrary tenant-private directory would otherwise drag this
      // static scan outside the pack, which violates the
      // read_only_pack_fixture_static_check boundary.
      if (entry.isSymbolicLink()) {
        continue;
      }

      const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  walk(absoluteDir, "");
  return files;
}

function parseJson<T>(absolutePath: string, readFile: FileReader): JsonParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(readFile(absolutePath)) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown JSON parse error",
    };
  }
}

function countStatuses(checks: readonly PackFixtureCheck[]): Record<PackFixtureCheckStatus, number> {
  return checks.reduce<Record<PackFixtureCheckStatus, number>>(
    (counts, check) => {
      counts[check.status] += 1;
      return counts;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

function resolvePack(rootDir: string, packPath: string) {
  const root = path.resolve(rootDir);
  const absolutePackPath = path.isAbsolute(packPath)
    ? path.resolve(packPath)
    : path.resolve(root, packPath);
  const relativePackPath = path.relative(root, absolutePackPath) || ".";
  const insideRoot = !relativePackPath.startsWith("..") && !path.isAbsolute(relativePackPath);

  return {
    root,
    absolutePackPath,
    relativePackPath,
    insideRoot,
  };
}

function fileCheck(
  absolutePackPath: string,
  packRelativePath: string,
  exists: FileExists,
): PackFixtureCheck {
  const present = exists(path.join(absolutePackPath, packRelativePath));

  return {
    id: `file:${packRelativePath}`,
    title: packRelativePath,
    status: present ? "pass" : "fail",
    detail: present ? "required pack file is present" : "required pack file is missing",
    nextAction: present ? undefined : `restore ${packRelativePath} before using this pack`,
  };
}

function manifestValidationCheck(manifest: HsiPackManifest | null): PackFixtureCheck {
  if (!manifest) {
    return {
      id: "hsi-manifest:validate",
      title: "HSI pack manifest validation",
      status: "fail",
      detail: "hsi-pack.manifest.json could not be parsed",
      nextAction: "fix hsi-pack.manifest.json before running HSI eval",
    };
  }

  const violations = validateHsiPackManifest(manifest);

  return {
    id: "hsi-manifest:validate",
    title: "HSI pack manifest validation",
    status: violations.length === 0 ? "pass" : "fail",
    detail:
      violations.length === 0
        ? "manifest satisfies the HSI offline contract"
        : `manifest violation(s): ${violations.join(", ")}`,
    nextAction: violations.length === 0 ? undefined : "fix the pack manifest or update HSI requirements",
  };
}

function nonSalesforceSourceCheck(manifest: HsiPackManifest | null): PackFixtureCheck {
  const hasNonSalesforceSource =
    !!manifest?.sourceKinds.some((kind) => NON_SALESFORCE_SOURCE_KINDS.has(kind));

  return {
    id: "hsi-manifest:non-salesforce-source",
    title: "non-Salesforce source coverage",
    status: hasNonSalesforceSource ? "pass" : "fail",
    detail: hasNonSalesforceSource
      ? "pack declares at least one non-Salesforce source kind"
      : "pack must not depend on Salesforce as the only reference source",
    nextAction: hasNonSalesforceSource
      ? undefined
      : "add case_system, im, meeting, email, spreadsheet, external_agent_output or vertical_system",
  };
}

function signalFamilyCoverageCheck(manifest: HsiPackManifest | null): PackFixtureCheck {
  const declaredFamilies = new Set(manifest?.signalFamilies ?? []);
  const missing = HSI_SIGNAL_FAMILIES.filter((family) => !declaredFamilies.has(family));

  return {
    id: "hsi-manifest:signal-family-coverage",
    title: "signal family coverage",
    status: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? "pack declares all six HSI signal families"
        : `missing signal family declaration(s): ${missing.join(", ")}`,
    nextAction:
      missing.length === 0
        ? undefined
        : "either add synthetic fixtures for missing families or explicitly keep the pack as pending owner truth",
  };
}

const MINIMUM_REVIEW_SURFACES = ["operating_signal_flow_map", "review_packet"] as const;

function reviewSurfaceCheck(manifest: HsiPackManifest | null): PackFixtureCheck {
  const surfaces = new Set(manifest?.reviewSurfaces ?? []);
  const missing = MINIMUM_REVIEW_SURFACES.filter(
    (surface) => !surfaces.has(surface as never),
  );

  return {
    id: "hsi-manifest:minimum-review-surfaces",
    title: "minimum review surface coverage",
    status: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? `pack declares at least the minimum review surfaces: ${MINIMUM_REVIEW_SURFACES.join(" + ")}`
        : `missing minimum review surface declaration(s): ${missing.join(", ")}`,
    nextAction:
      missing.length === 0
        ? undefined
        : `add at least ${MINIMUM_REVIEW_SURFACES.join(" and ")} to the manifest`,
  };
}

function tenantManifestAlignmentCheck(
  tenantManifest: TenantManifest | null,
  hsiManifest: HsiPackManifest | null,
): PackFixtureCheck {
  if (!tenantManifest || !hsiManifest) {
    return {
      id: "tenant-manifest:pack-id-alignment",
      title: "tenant manifest / HSI manifest alignment",
      status: "fail",
      detail: "tenant manifest or HSI manifest could not be parsed",
      nextAction: "fix both JSON files before using this pack as a fork base",
    };
  }

  const aligned = tenantManifest.tenantKey === hsiManifest.packId;

  return {
    id: "tenant-manifest:pack-id-alignment",
    title: "tenant manifest / HSI manifest alignment",
    status: aligned ? "pass" : "fail",
    detail: aligned
      ? "tenantKey matches HSI packId"
      : `tenantKey (${tenantManifest.tenantKey ?? "missing"}) does not match packId (${hsiManifest.packId})`,
    nextAction: aligned ? undefined : "make tenant.manifest.json tenantKey match hsi-pack.manifest.json packId",
  };
}

function implementationChecklistCheck(
  rootDir: string,
  manifest: HsiPackManifest | null,
  exists: FileExists,
): PackFixtureCheck {
  const ref = manifest?.implementationChecklistRef;
  const present = !!ref && exists(path.join(rootDir, ref));

  return {
    id: "hsi-manifest:implementation-checklist",
    title: "implementation checklist reference",
    status: present ? "pass" : "fail",
    detail: present
      ? `implementation checklist exists: ${ref}`
      : "manifest must point to a checked-in implementation checklist or README",
    nextAction: present ? undefined : "add implementationChecklistRef or restore the referenced file",
  };
}

function fixtureFilesCheck(
  absolutePackPath: string,
  exists: FileExists,
  listFiles: FileLister,
): { check: PackFixtureCheck; fixtureFiles: readonly string[] } {
  const fixturesDir = path.join(absolutePackPath, "fixtures");
  if (!exists(fixturesDir)) {
    return {
      check: {
        id: "fixtures:json-files",
        title: "fixture JSON files",
        status: "fail",
        detail: "fixtures directory is missing",
        nextAction: "add synthetic / redacted JSON fixtures under fixtures/",
      },
      fixtureFiles: [],
    };
  }

  const fixtureFiles = listFiles(fixturesDir)
    .filter((relativePath) => relativePath.endsWith(".json"))
    .sort();

  return {
    check: {
      id: "fixtures:json-files",
      title: "fixture JSON files",
      status: fixtureFiles.length > 0 ? "pass" : "fail",
      detail:
        fixtureFiles.length > 0
          ? `${fixtureFiles.length} fixture JSON file(s) found`
          : "no fixture JSON files found",
      nextAction: fixtureFiles.length > 0 ? undefined : "add at least one synthetic / redacted JSON fixture",
    },
    fixtureFiles,
  };
}

function fixtureJsonParseCheck(
  absolutePackPath: string,
  fixtureFiles: readonly string[],
  readFile: FileReader,
): PackFixtureCheck {
  const invalid: string[] = [];
  const emptyArrays: string[] = [];

  for (const relativePath of fixtureFiles) {
    const parsed = parseJson<unknown>(path.join(absolutePackPath, "fixtures", relativePath), readFile);
    if (!parsed.ok) {
      invalid.push(`${relativePath}:${parsed.error}`);
      continue;
    }
    if (Array.isArray(parsed.value) && parsed.value.length === 0) {
      emptyArrays.push(relativePath);
    }
  }

  const failures = [...invalid, ...emptyArrays.map((relativePath) => `${relativePath}:empty_array`)];

  return {
    id: "fixtures:json-parse",
    title: "fixture JSON parse",
    status: failures.length === 0 ? "pass" : "fail",
    detail:
      failures.length === 0
        ? "all fixture JSON files parse and are non-empty when array-shaped"
        : `fixture parse / shape issue(s): ${failures.join(", ")}`,
    nextAction: failures.length === 0 ? undefined : "rewrite fixtures before running eval or demo smoke",
  };
}

function sensitiveFixtureCheck(
  absolutePackPath: string,
  fixtureFiles: readonly string[],
  readFile: FileReader,
): PackFixtureCheck {
  const hits: Array<{ file: string; markers: readonly string[] }> = [];

  for (const relativePath of fixtureFiles) {
    const content = readFile(path.join(absolutePackPath, "fixtures", relativePath));
    const matchedMarkers = scanForSensitiveMarkers(content);
    if (matchedMarkers.length > 0) {
      hits.push({ file: relativePath, markers: matchedMarkers });
    }
  }

  return {
    id: "fixtures:credential-and-cloud-host-marker-scan",
    title: "fixture credential / cloud-host marker scan",
    status: hits.length === 0 ? "pass" : "fail",
    detail:
      hits.length === 0
        ? "no credential or known cloud-host markers found in fixture JSON files"
        : `credential / cloud-host marker(s) found: ${hits
            .map((h) => `${h.file}[${h.markers.join("+")}]`)
            .join(", ")}`,
    nextAction: hits.length === 0 ? undefined : "replace fixture values with synthetic / redacted examples",
  };
}

function buildSummary(
  packPath: string,
  checks: readonly PackFixtureCheck[],
): PackFixtureCheckSummary {
  const counts = countStatuses(checks);
  return {
    version: "delivery_engineer_pack_fixture_check_v1",
    boundary: "read_only_pack_fixture_static_check",
    packPath,
    passed: counts.fail === 0,
    counts,
    checks: [...checks],
    nextCommands: [
      `npm run pack:fixture-check -- --pack ${packPath}`,
      "npm run eval:headless-signal-interface",
      "npm run check:public-release",
    ],
  };
}

export function runPackFixtureCheck(
  options: RunPackFixtureCheckOptions = {},
): PackFixtureCheckSummary {
  const packPath = options.packPath ?? DEFAULT_PACK_PATH;
  const rootDir = options.rootDir ?? process.cwd();
  const exists = options.exists ?? existsSync;
  const readFile = options.readFile ?? defaultReadFile;
  const listFiles = options.listFiles ?? defaultListFiles;
  const resolved = resolvePack(rootDir, packPath);

  const scopeCheck: PackFixtureCheck = {
    id: "pack-path:inside-repo",
    title: "pack path stays inside repo",
    status: resolved.insideRoot ? "pass" : "fail",
    detail: resolved.insideRoot
      ? `checking ${resolved.relativePackPath}`
      : `pack path escapes repo root: ${packPath}`,
    nextAction: resolved.insideRoot ? undefined : "pass a pack path inside the repo checkout",
  };

  if (!resolved.insideRoot) {
    return buildSummary(packPath, [scopeCheck]);
  }

  const checks: PackFixtureCheck[] = [
    scopeCheck,
    ...REQUIRED_PACK_FILES.map((relativePath) =>
      fileCheck(resolved.absolutePackPath, relativePath, exists),
    ),
  ];

  const hsiManifestPath = path.join(resolved.absolutePackPath, "hsi-pack.manifest.json");
  const tenantManifestPath = path.join(resolved.absolutePackPath, "tenant.manifest.json");
  const hsiManifestParse = exists(hsiManifestPath)
    ? parseJson<HsiPackManifest>(hsiManifestPath, readFile)
    : { ok: false as const, error: "missing hsi-pack.manifest.json" };
  const tenantManifestParse = exists(tenantManifestPath)
    ? parseJson<TenantManifest>(tenantManifestPath, readFile)
    : { ok: false as const, error: "missing tenant.manifest.json" };

  checks.push({
    id: "hsi-manifest:json-parse",
    title: "HSI pack manifest JSON",
    status: hsiManifestParse.ok ? "pass" : "fail",
    detail: hsiManifestParse.ok ? "hsi-pack.manifest.json parses" : hsiManifestParse.error,
    nextAction: hsiManifestParse.ok ? undefined : "fix hsi-pack.manifest.json",
  });
  checks.push({
    id: "tenant-manifest:json-parse",
    title: "tenant manifest JSON",
    status: tenantManifestParse.ok ? "pass" : "fail",
    detail: tenantManifestParse.ok ? "tenant.manifest.json parses" : tenantManifestParse.error,
    nextAction: tenantManifestParse.ok ? undefined : "fix tenant.manifest.json",
  });

  const hsiManifest = hsiManifestParse.ok ? hsiManifestParse.value : null;
  const tenantManifest = tenantManifestParse.ok ? tenantManifestParse.value : null;
  checks.push(manifestValidationCheck(hsiManifest));
  checks.push(nonSalesforceSourceCheck(hsiManifest));
  checks.push(signalFamilyCoverageCheck(hsiManifest));
  checks.push(reviewSurfaceCheck(hsiManifest));
  checks.push(tenantManifestAlignmentCheck(tenantManifest, hsiManifest));
  checks.push(implementationChecklistCheck(resolved.root, hsiManifest, exists));

  const fixtureFileResult = fixtureFilesCheck(resolved.absolutePackPath, exists, listFiles);
  checks.push(fixtureFileResult.check);
  checks.push(fixtureJsonParseCheck(resolved.absolutePackPath, fixtureFileResult.fixtureFiles, readFile));
  checks.push(sensitiveFixtureCheck(resolved.absolutePackPath, fixtureFileResult.fixtureFiles, readFile));

  return buildSummary(resolved.relativePackPath, checks);
}
