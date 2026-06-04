import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { scanForSensitiveMarkers } from "./sensitive-markers";

export type DeliveryDoctorStatus = "pass" | "warn" | "fail";

export type DeliveryDoctorCheck = {
  id: string;
  title: string;
  status: DeliveryDoctorStatus;
  detail: string;
  nextAction?: string;
};

export type DeliveryDoctorSummary = {
  version: "delivery_engineer_golden_path_doctor_v1";
  boundary: "read_only_local_repo_static_check";
  passed: boolean;
  counts: Record<DeliveryDoctorStatus, number>;
  checks: DeliveryDoctorCheck[];
  nextCommands: string[];
};

type PackageJson = {
  scripts?: Record<string, string>;
};

type FileReader = (absolutePath: string) => string;
type FileExists = (absolutePath: string) => boolean;
type DirectoryLister = (absoluteDir: string) => readonly string[];

export type RunDeliveryDoctorOptions = {
  /**
   * Optional root directory override. PRIMARILY FOR TESTS — production
   * callers should let this default to `process.cwd()`. Passing an
   * absolute path outside the current repo is unsupported.
   */
  rootDir?: string;
  exists?: FileExists;
  readFile?: FileReader;
  listDirectory?: DirectoryLister;
};

/**
 * Files this doctor expects every Golden Path checkout to contain.
 *
 * This list is intentionally tightly coupled to the Headless Signal
 * Interface module layout — when HSI files move (e.g. an HSI module
 * rename), the corresponding entries here must be updated in lockstep,
 * otherwise `delivery:doctor` will report a misleading "missing file"
 * failure that is actually a stale doctor list. Treat REQUIRED_FILES
 * as part of the Golden Path / HSI cross-module contract.
 */
const REQUIRED_FILES = [
  "README.md",
  "docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md",
  "docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md",
  "docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md",
  "docs/reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md",
  "docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md",
  "extensions/case-management-sample/README.md",
  "extensions/case-management-sample/tenant.manifest.json",
  "extensions/case-management-sample/hsi-pack.manifest.json",
  "extensions/case-management-sample/fixtures/case.sample.json",
  "extensions/case-management-sample/signals/case/case-mapper.ts",
  "extensions/case-management-sample/signals/review-packet.ts",
  "extensions/case-management-sample/workers/case-allocation-driver/decide.ts",
  "extensions/case-management-sample/workers/case-stewardship-driver/decide.ts",
  "lib/headless-signal-interface/pack-manifest.ts",
  "lib/headless-signal-interface/facade-types.ts",
  "evals/headless-signal-interface/headless-signal-interface-cases.json",
  "lib/evals/headless-signal-interface-evals.ts",
  "scripts/headless-signal-interface-evals.ts",
  "lib/delivery-engineer/pack-fixture-check.ts",
  "scripts/pack-fixture-check.ts",
] as const;

const REQUIRED_PACKAGE_SCRIPTS = [
  "delivery:doctor",
  "eval:headless-signal-interface",
  "eval:operating-signal-flow",
  "pack:fixture-check",
  "check:public-release",
  "check:boundaries",
  "self-check",
] as const;

const SAMPLE_TEST_PATHS = [
  "extensions/case-management-sample/signals/types.test.ts",
  "extensions/case-management-sample/signals/case/case-mapper.test.ts",
  "extensions/case-management-sample/workers/manifest.test.ts",
  "extensions/case-management-sample/workers/worker-modes.test.ts",
  "extensions/case-management-sample/workers/lifecycle-objectives.test.ts",
  "extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts",
  "extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts",
  "extensions/case-management-sample/bi-report/manifest.test.ts",
] as const;

const FRESH_CLONE_RECEIPT_DIRECTORY = "docs/reviews";
const FRESH_CLONE_RECEIPT_PATTERN = /^HELM_DELIVERY_ENGINEER_D2_SMOKE.*\.md$/;
const ENV_EXAMPLE_PATH = ".env.example";

function helmEnvKey(...parts: readonly string[]) {
  return ["HELM", ...parts].join("_");
}

function defaultReadFile(absolutePath: string) {
  return readFileSync(absolutePath, "utf8");
}

function defaultListDirectory(absoluteDir: string): readonly string[] {
  try {
    return readdirSync(absoluteDir);
  } catch {
    return [];
  }
}

function fileStatus(rootDir: string, relativePath: string, exists: FileExists): DeliveryDoctorCheck {
  const absolutePath = path.join(rootDir, relativePath);
  const present = exists(absolutePath);

  return {
    id: `file:${relativePath}`,
    title: relativePath,
    status: present ? "pass" : "fail",
    detail: present ? "required Golden Path file is present" : "required Golden Path file is missing",
    nextAction: present ? undefined : `restore or add ${relativePath}`,
  };
}

function parsePackageJson(rootDir: string, readFile: FileReader): PackageJson | null {
  try {
    return JSON.parse(readFile(path.join(rootDir, "package.json"))) as PackageJson;
  } catch {
    return null;
  }
}

function packageScriptStatus(packageJson: PackageJson | null, scriptName: string): DeliveryDoctorCheck {
  const command = packageJson?.scripts?.[scriptName];

  return {
    id: `script:${scriptName}`,
    title: `npm run ${scriptName}`,
    status: command ? "pass" : "fail",
    detail: command ? `declared as: ${command}` : "required npm script is missing",
    nextAction: command ? undefined : `add package.json script ${scriptName}`,
  };
}

function dockerComposeStatus(rootDir: string, exists: FileExists): DeliveryDoctorCheck {
  const hasDockerCompose = exists(path.join(rootDir, "docker-compose.yml"));

  return {
    id: "docker-compose:declared",
    title: "docker compose entrypoint",
    status: hasDockerCompose ? "pass" : "warn",
    detail: hasDockerCompose
      ? "docker-compose.yml exists; doctor does not run Docker"
      : "docker-compose.yml is missing; 30-minute onboarding cannot be rehearsed from the documented path",
    nextAction: hasDockerCompose ? undefined : "restore docker-compose.yml or update onboarding docs",
  };
}

function sampleTestStatus(rootDir: string, exists: FileExists): DeliveryDoctorCheck {
  const missing = SAMPLE_TEST_PATHS.filter((relativePath) => !exists(path.join(rootDir, relativePath)));

  return {
    id: "case-management-sample:targeted-tests",
    title: "case-management-sample targeted tests",
    status: missing.length === 0 ? "pass" : "warn",
    detail:
      missing.length === 0
        ? `${SAMPLE_TEST_PATHS.length} targeted sample test file(s) are present`
        : `${missing.length} targeted sample test file(s) missing: ${missing.join(", ")}`,
    nextAction:
      missing.length === 0
        ? "run the targeted vitest command before release smoke"
        : "restore missing sample test files before claiming the sample pack is forkable",
  };
}

function sensitiveSampleStatus(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
): DeliveryDoctorCheck {
  const sampleFiles = REQUIRED_FILES.filter((relativePath) =>
    relativePath.startsWith("extensions/case-management-sample/"),
  );
  const hits: Array<{ file: string; markers: readonly string[] }> = [];

  for (const relativePath of sampleFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!exists(absolutePath)) continue;

    const content = readFile(absolutePath);
    const matchedMarkers = scanForSensitiveMarkers(content);
    if (matchedMarkers.length > 0) {
      hits.push({ file: relativePath, markers: matchedMarkers });
    }
  }

  return {
    id: "case-management-sample:credential-and-cloud-host-marker-scan",
    title: "case-management-sample credential / cloud-host marker scan",
    status: hits.length === 0 ? "pass" : "fail",
    detail:
      hits.length === 0
        ? "no credential or known cloud-host markers found in core sample files"
        : `credential / cloud-host marker(s) found: ${hits
            .map((h) => `${h.file}[${h.markers.join("+")}]`)
            .join(", ")}`,
    nextAction: hits.length === 0 ? undefined : "rewrite sample values before public release or forkable demo",
  };
}

function freshCloneStatus(
  rootDir: string,
  listDirectory: DirectoryLister,
): DeliveryDoctorCheck {
  const directoryEntries = listDirectory(path.join(rootDir, FRESH_CLONE_RECEIPT_DIRECTORY));
  const matchingReceipts = directoryEntries.filter((name) => FRESH_CLONE_RECEIPT_PATTERN.test(name));
  const hasReceipt = matchingReceipts.length > 0;

  return {
    id: "fresh-clone:d2-smoke-receipt",
    title: "D2 fresh-clone smoke receipt",
    status: hasReceipt ? "pass" : "warn",
    detail: hasReceipt
      ? `${matchingReceipts.length} D2 smoke receipt file(s) found: ${matchingReceipts.join(", ")}`
      : "no fresh-clone smoke receipt found under docs/reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE*.md; 30-minute onboarding remains a target, not a verified promise",
    nextAction: hasReceipt ? undefined : "run D2 smoke in a clean checkout before publishing time claims",
  };
}

function parseEnvExample(rootDir: string, exists: FileExists, readFile: FileReader) {
  const absolutePath = path.join(rootDir, ENV_EXAMPLE_PATH);
  if (!exists(absolutePath)) return null;

  const env: Record<string, string> = {};
  for (const line of readFile(absolutePath).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(trimmed);
    if (!match) continue;
    env[match[1] as string] = match[2]?.trim().replace(/^"|"$/gu, "") ?? "";
  }
  return env;
}

function chinaProfileStatus(env: Record<string, string> | null): DeliveryDoctorCheck {
  if (!env) {
    return {
      id: "china-profile:public-env-defaults",
      title: "China delivery profile public env defaults",
      status: "fail",
      detail: ".env.example is missing; Qwen, region / residency, and npm registry posture cannot be checked",
      nextAction: "restore .env.example with public-safe profile defaults",
    };
  }

  const missing = [
    helmEnvKey("DEPLOYMENT", "REGION"),
    helmEnvKey("DATA", "RESIDENCY"),
    "NPM_CONFIG_REGISTRY",
    "DASHSCOPE_BASE_URL",
    "LLM_DEFAULT_PROVIDER",
  ].filter((key) => !env[key]);
  const qwenDefault = env.LLM_DEFAULT_PROVIDER === "qwen";

  return {
    id: "china-profile:public-env-defaults",
    title: "China delivery profile public env defaults",
    status: missing.length === 0 && qwenDefault ? "pass" : "fail",
    detail:
      missing.length === 0 && qwenDefault
        ? "Qwen, region / residency, and npm registry override defaults are visible in .env.example"
        : `profile default issue(s): ${[
            ...missing.map((key) => `missing ${key}`),
            qwenDefault ? null : "LLM_DEFAULT_PROVIDER must default to qwen",
          ]
            .filter(Boolean)
            .join(", ")}`,
    nextAction:
      missing.length === 0 && qwenDefault
        ? undefined
        : "restore public-safe China profile defaults without claiming production compliance",
  };
}

function asrOpenAIOnlyStatus(env: Record<string, string> | null): DeliveryDoctorCheck {
  if (!env) {
    return {
      id: "asr:openai-only-precheck",
      title: "OpenAI-only ASR precheck",
      status: "fail",
      detail: ".env.example is missing; ASR provider posture cannot be checked",
      nextAction: "restore .env.example with ASR_OPENAI_MODEL and ASR_ENABLED defaults",
    };
  }

  const issues: string[] = [];
  if ("ASR_PROVIDER" in env) {
    issues.push("ASR_PROVIDER must not be declared; ASR is OpenAI-only in public Core");
  }
  if (!env.ASR_OPENAI_MODEL) {
    issues.push("ASR_OPENAI_MODEL is required for the OpenAI-only ASR path");
  }
  if (!("ASR_ENABLED" in env)) {
    issues.push("ASR_ENABLED is required so forks can keep ASR disabled by default");
  }

  return {
    id: "asr:openai-only-precheck",
    title: "OpenAI-only ASR precheck",
    status: issues.length === 0 ? "pass" : "fail",
    detail:
      issues.length === 0
        ? "ASR is explicitly OpenAI-only and disabled-by-default in .env.example"
        : issues.join("; "),
    nextAction:
      issues.length === 0
        ? undefined
        : "remove generic / Qwen ASR provider wiring and keep ASR behind OpenAI configuration",
  };
}

function connectorTokenSecretStatus(env: Record<string, string> | null): DeliveryDoctorCheck {
  const hasPlaceholder = Boolean(env?.CONNECTOR_TOKEN_SECRET);

  return {
    id: "connector-token:minimal-secret-placeholder",
    title: "connector token minimal persistence placeholder",
    status: hasPlaceholder ? "pass" : "fail",
    detail: hasPlaceholder
      ? "CONNECTOR_TOKEN_SECRET placeholder exists; connector tokens are not stored as raw public fixtures"
      : "CONNECTOR_TOKEN_SECRET is missing from .env.example",
    nextAction: hasPlaceholder
      ? undefined
      : "restore CONNECTOR_TOKEN_SECRET placeholder and keep real connector secrets out of the repo",
  };
}

function countStatuses(checks: DeliveryDoctorCheck[]): Record<DeliveryDoctorStatus, number> {
  return checks.reduce<Record<DeliveryDoctorStatus, number>>(
    (counts, check) => {
      counts[check.status] += 1;
      return counts;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

export function runDeliveryEngineerGoldenPathDoctor(
  options: RunDeliveryDoctorOptions = {},
): DeliveryDoctorSummary {
  const rootDir = options.rootDir ?? process.cwd();
  const exists = options.exists ?? existsSync;
  const readFile = options.readFile ?? defaultReadFile;
  const listDirectory = options.listDirectory ?? defaultListDirectory;
  const packageJson = parsePackageJson(rootDir, readFile);
  const envExample = parseEnvExample(rootDir, exists, readFile);

  const checks: DeliveryDoctorCheck[] = [
    ...REQUIRED_FILES.map((relativePath) => fileStatus(rootDir, relativePath, exists)),
    ...REQUIRED_PACKAGE_SCRIPTS.map((scriptName) => packageScriptStatus(packageJson, scriptName)),
    dockerComposeStatus(rootDir, exists),
    sampleTestStatus(rootDir, exists),
    sensitiveSampleStatus(rootDir, exists, readFile),
    freshCloneStatus(rootDir, listDirectory),
    chinaProfileStatus(envExample),
    asrOpenAIOnlyStatus(envExample),
    connectorTokenSecretStatus(envExample),
  ];

  const counts = countStatuses(checks);

  return {
    version: "delivery_engineer_golden_path_doctor_v1",
    boundary: "read_only_local_repo_static_check",
    passed: counts.fail === 0,
    counts,
    checks,
    nextCommands: [
      "npm run delivery:doctor",
      "npm run pack:fixture-check",
      "npm run eval:headless-signal-interface",
      "npm run eval:operating-signal-flow",
      "npm run check:public-release",
      "npm run self-check",
      "npm run check:boundaries",
    ],
  };
}
