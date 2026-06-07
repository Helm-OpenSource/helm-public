import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { scanForSensitiveMarkers } from "./sensitive-markers";

export type DeliveryDoctorStatus = "pass" | "warn" | "fail";
export type DeliveryDoctorRegionProfile = "global" | "cn";

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
  regionProfile: DeliveryDoctorRegionProfile;
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
type DoctorEnv = Record<string, string | undefined>;

export type RunDeliveryDoctorOptions = {
  /**
   * Optional root directory override. PRIMARILY FOR TESTS — production
   * callers should let this default to `process.cwd()`. Passing an
   * absolute path outside the current repo is unsupported.
   */
  rootDir?: string;
  regionProfile?: DeliveryDoctorRegionProfile;
  env?: DoctorEnv;
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
  "docs/product/HELM_DELIVERY_ENGINEER_SETUP_DIAGNOSTIC_REQUIREMENTS.md",
  "docs/product/HELM_DATA_INTAKE_EXPERIENCE.md",
  "docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md",
  "docs/reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md",
  "docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md",
  "features/settings/data-intake-ux.ts",
  "templates/signal-first-mile/run-first-change-proof.js",
  "templates/signal-first-mile/selector-input.sample.json",
  "templates/signal-first-mile/signal-quality-eval.js",
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
  "eval:signal-first-mile-quality",
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
const ROOT_ENV_FILE_ORDER = [".env.example", ".env", ".env.local"] as const;
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

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvFileContent(content: string): DoctorEnv {
  const values: DoctorEnv = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) {
      continue;
    }

    values[key] = stripEnvQuotes(normalized.slice(separatorIndex + 1));
  }

  return values;
}

function loadDoctorEnv(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
  runtimeEnv: DoctorEnv,
): DoctorEnv {
  const loaded: DoctorEnv = {};

  for (const fileName of ROOT_ENV_FILE_ORDER) {
    const absolutePath = path.join(rootDir, fileName);
    if (!exists(absolutePath)) {
      continue;
    }

    try {
      Object.assign(loaded, parseEnvFileContent(readFile(absolutePath)));
    } catch {
      // A malformed local env file should not make the static doctor crash.
      // Specific config checks below will surface missing values as warnings.
    }
  }

  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (typeof value === "string") {
      loaded[key] = value;
    }
  }

  return loaded;
}

function envValue(env: DoctorEnv, key: string): string {
  return env[key]?.trim() ?? "";
}

function isEnvTrue(value: string): boolean {
  return value.trim().toLowerCase() === "true";
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

function readRepoFile(
  rootDir: string,
  relativePath: string,
  exists: FileExists,
  readFile: FileReader,
): string | null {
  const absolutePath = path.join(rootDir, relativePath);
  if (!exists(absolutePath)) {
    return null;
  }

  try {
    return readFile(absolutePath);
  } catch {
    return null;
  }
}

function containsAll(content: string, markers: readonly string[]) {
  const normalized = content.toLowerCase();
  return markers.every((marker) => normalized.includes(marker.toLowerCase()));
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

function sourceIntakeSetupDiagnosticDocStatus(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
): DeliveryDoctorCheck {
  const relativePath = "docs/product/HELM_DELIVERY_ENGINEER_SETUP_DIAGNOSTIC_REQUIREMENTS.md";
  const content = readRepoFile(rootDir, relativePath, exists, readFile);
  const requiredMarkers = ["L0", "L1", "L2", "source intake", "read-only", "writeback"];
  const passed = Boolean(content && containsAll(content, requiredMarkers));

  return {
    id: "source-intake:setup-diagnostic-doc",
    title: "source-intake setup diagnostic requirements",
    status: passed ? "pass" : "fail",
    detail: passed
      ? "setup diagnostic requirements doc keeps source-intake, L0/L1/L2, read-only, and forbidden-action posture visible"
      : `${relativePath} is missing required source-intake, L0/L1/L2, read-only, or forbidden-action markers`,
    nextAction: passed
      ? undefined
      : "restore the setup diagnostic requirements doc before extending onboarding claims",
  };
}

function sourceIntakeProofPackageStaticAssetsStatus(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
): DeliveryDoctorCheck {
  const scriptPath = "templates/signal-first-mile/run-first-change-proof.js";
  const selectorPath = "templates/signal-first-mile/selector-input.sample.json";
  const qualityEvalPath = "templates/signal-first-mile/signal-quality-eval.js";
  const scriptContent = readRepoFile(rootDir, scriptPath, exists, readFile);
  const selectorContent = readRepoFile(rootDir, selectorPath, exists, readFile);
  const qualityEvalContent = readRepoFile(rootDir, qualityEvalPath, exists, readFile);
  const scriptHasExpectedOutputs = Boolean(
    scriptContent &&
      containsAll(scriptContent, [
        "evalCommand",
        "MANIFEST.json",
        "customer-materials.md",
        "signal-quality-report.md",
        "hsi-fixture.json",
        "review-packet.md",
      ]),
  );
  const passed = Boolean(scriptHasExpectedOutputs && selectorContent && qualityEvalContent);

  return {
    id: "source-intake:proof-package-static-assets",
    title: "Signal First Mile static proof package assets",
    status: passed ? "pass" : "fail",
    detail: passed
      ? "in-repo proof package generator, selector sample, quality eval, manifest, customer materials, quality report, HSI fixture, and review packet markers are present"
      : "in-repo Signal First Mile proof package script, selector sample, quality eval, or expected output markers are missing",
    nextAction: passed
      ? undefined
      : "restore Signal First Mile static assets before showing proof package guidance",
  };
}

function sourceIntakeLadderContractStatus(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
): DeliveryDoctorCheck {
  const dataIntakeDoc = readRepoFile(
    rootDir,
    "docs/product/HELM_DATA_INTAKE_EXPERIENCE.md",
    exists,
    readFile,
  );
  const dataIntakeUx = readRepoFile(rootDir, "features/settings/data-intake-ux.ts", exists, readFile);
  const passed = containsAll(dataIntakeDoc ?? "", ["L0", "L1", "L2"]) &&
    containsAll(dataIntakeUx ?? "", ["L0", "L1", "L2"]);

  return {
    id: "source-intake:l0-l1-l2-contract",
    title: "source-intake L0/L1/L2 contract",
    status: passed ? "pass" : "fail",
    detail: passed
      ? "data-intake doc and setup UX keep the L0/L1/L2 source-intake ladder visible"
      : "data-intake doc or setup UX no longer exposes the L0/L1/L2 source-intake ladder",
    nextAction: passed
      ? undefined
      : "restore L0 diagnostic, L1 fixture/dry-run, and L2 read-only access markers",
  };
}

function sourceIntakeForbiddenActionBoundaryStatus(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
): DeliveryDoctorCheck {
  const dataIntakeDoc = readRepoFile(
    rootDir,
    "docs/product/HELM_DATA_INTAKE_EXPERIENCE.md",
    exists,
    readFile,
  );
  const dataIntakeUx = readRepoFile(rootDir, "features/settings/data-intake-ux.ts", exists, readFile);
  const requiredMarkers = ["writeback", "external send", "approval", "deployment"];
  const passed = containsAll(dataIntakeDoc ?? "", requiredMarkers) &&
    containsAll(dataIntakeUx ?? "", requiredMarkers);

  return {
    id: "source-intake:forbidden-action-boundary",
    title: "source-intake forbidden-action boundary",
    status: passed ? "pass" : "fail",
    detail: passed
      ? "source-intake docs and UX keep writeback, external send, approval execution, and deployment boundaries visible"
      : "source-intake docs or UX no longer state writeback, external send, approval, and deployment boundaries",
    nextAction: passed
      ? undefined
      : "restore forbidden-action wording before claiming setup diagnostic readiness",
  };
}

function qwenCredentialStatus(env: DoctorEnv): DeliveryDoctorCheck {
  const llmEnabled = isEnvTrue(envValue(env, "LLM_ENABLED"));
  const provider = envValue(env, "LLM_DEFAULT_PROVIDER").toLowerCase() || "qwen";
  const hasDashScopeKey = Boolean(envValue(env, "DASHSCOPE_API_KEY"));
  const hasOpenAIKey = Boolean(envValue(env, "OPENAI_API_KEY"));

  if (!llmEnabled) {
    return {
      id: "config:qwen-dashscope-key",
      title: "Qwen / DashScope credential alignment",
      status: "pass",
      detail: "LLM_ENABLED is not true; Qwen credential alignment is not active for this checkout",
    };
  }

  if (provider !== "qwen") {
    return {
      id: "config:qwen-dashscope-key",
      title: "Qwen / DashScope credential alignment",
      status: "pass",
      detail: `LLM_DEFAULT_PROVIDER=${provider}; Qwen credential alignment is not active`,
    };
  }

  if (hasDashScopeKey) {
    return {
      id: "config:qwen-dashscope-key",
      title: "Qwen / DashScope credential alignment",
      status: "pass",
      detail: "LLM_DEFAULT_PROVIDER=qwen and DASHSCOPE_API_KEY is present",
    };
  }

  if (hasOpenAIKey) {
    return {
      id: "config:qwen-dashscope-key",
      title: "Qwen / DashScope credential alignment",
      status: "warn",
      detail:
        "LLM_DEFAULT_PROVIDER=qwen but only OPENAI_API_KEY is present; the runtime Qwen key helper can fall back to OPENAI_API_KEY, which is usually a provider mismatch for DashScope",
      nextAction:
        "set DASHSCOPE_API_KEY for Qwen, or switch LLM_DEFAULT_PROVIDER=openai with an approved OpenAI-compatible endpoint",
    };
  }

  return {
    id: "config:qwen-dashscope-key",
    title: "Qwen / DashScope credential alignment",
    status: "warn",
    detail: "LLM_ENABLED=true and LLM_DEFAULT_PROVIDER=qwen, but DASHSCOPE_API_KEY is empty",
    nextAction: "set DASHSCOPE_API_KEY or set LLM_ENABLED=false for offline / placeholder-only runs",
  };
}

function chinaRegionResidencyStatus(
  regionProfile: DeliveryDoctorRegionProfile,
  env: DoctorEnv,
): DeliveryDoctorCheck {
  if (regionProfile !== "cn") {
    return {
      id: "config:china-region-residency",
      title: "China deployment profile",
      status: "pass",
      detail: "global profile selected; run `npm run delivery:doctor -- --region cn` for China deployment preflight",
    };
  }

  const deploymentRegion = envValue(env, "HELM_DEPLOYMENT_REGION");
  const dataResidency = envValue(env, "HELM_DATA_RESIDENCY");
  const ready = deploymentRegion === "cn" && dataResidency === "cn";

  return {
    id: "config:china-region-residency",
    title: "China deployment profile",
    status: ready ? "pass" : "warn",
    detail: ready
      ? "HELM_DEPLOYMENT_REGION=cn and HELM_DATA_RESIDENCY=cn are aligned"
      : `China profile requested but HELM_DEPLOYMENT_REGION=${deploymentRegion || "<empty>"} and HELM_DATA_RESIDENCY=${dataResidency || "<empty>"}`,
    nextAction: ready
      ? undefined
      : "set HELM_DEPLOYMENT_REGION=cn and HELM_DATA_RESIDENCY=cn before claiming China-region delivery readiness",
  };
}

function chinaNpmRegistryStatus(
  regionProfile: DeliveryDoctorRegionProfile,
  rootDir: string,
  exists: FileExists,
  env: DoctorEnv,
): DeliveryDoctorCheck {
  if (regionProfile !== "cn") {
    return {
      id: "network:china-npm-registry",
      title: "Mainland China npm registry hint",
      status: "pass",
      detail: "global profile selected; npm mirror preflight is skipped",
    };
  }

  const hasNpmRegistry = Boolean(envValue(env, "NPM_REGISTRY"));
  const hasLocalNpmrc = exists(path.join(rootDir, ".npmrc"));
  const ready = hasNpmRegistry || hasLocalNpmrc;

  return {
    id: "network:china-npm-registry",
    title: "Mainland China npm registry hint",
    status: ready ? "pass" : "warn",
    detail: ready
      ? "local npm mirror hint is present through NPM_REGISTRY or .npmrc"
      : "China profile requested but neither NPM_REGISTRY nor local .npmrc is present",
    nextAction: ready
      ? undefined
      : "run `cp .npmrc.example .npmrc` for local npm, or prefix Docker builds with `NPM_REGISTRY=https://registry.npmmirror.com`",
  };
}

function chinaDockerMirrorGuidanceStatus(
  rootDir: string,
  exists: FileExists,
  readFile: FileReader,
): DeliveryDoctorCheck {
  const docsToCheck = ["docs/getting-started.md", "docs/getting-started.en.md"];
  const missingGuidance = docsToCheck.filter((relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    if (!exists(absolutePath)) {
      return true;
    }
    const content = readFile(absolutePath);
    return !content.includes("registry-mirrors") || !content.includes("NPM_REGISTRY");
  });

  return {
    id: "network:china-docker-mirror-guidance",
    title: "Mainland China Docker / npm mirror guidance",
    status: missingGuidance.length === 0 ? "pass" : "warn",
    detail:
      missingGuidance.length === 0
        ? "bilingual getting-started docs include Docker registry mirror and NPM_REGISTRY guidance"
        : `mirror guidance missing or incomplete in: ${missingGuidance.join(", ")}`,
    nextAction:
      missingGuidance.length === 0
        ? undefined
        : "document Docker daemon registry-mirrors and Docker build NPM_REGISTRY before promoting the 90-second demo path in restricted networks",
  };
}

function asrChinaBoundaryStatus(
  regionProfile: DeliveryDoctorRegionProfile,
  env: DoctorEnv,
): DeliveryDoctorCheck {
  const asrEnabled = isEnvTrue(envValue(env, "ASR_ENABLED"));

  if (regionProfile !== "cn" || !asrEnabled) {
    return {
      id: "config:asr-openai-china-boundary",
      title: "ASR China boundary",
      status: "pass",
      detail:
        regionProfile !== "cn"
          ? "global profile selected; China ASR boundary preflight is skipped"
          : "ASR_ENABLED is not true; OpenAI-only ASR path is disabled for this China preflight",
    };
  }

  return {
    id: "config:asr-openai-china-boundary",
    title: "ASR China boundary",
    status: "warn",
    detail:
      "China profile requested and ASR_ENABLED=true, but the current capture ASR implementation is OpenAI-only",
    nextAction:
      "keep ASR_ENABLED=false for China customer delivery unless an approved ASR provider, outbound consent, and PII handling path are implemented",
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
  const regionProfile = options.regionProfile ?? "global";
  const exists = options.exists ?? existsSync;
  const readFile = options.readFile ?? defaultReadFile;
  const listDirectory = options.listDirectory ?? defaultListDirectory;
  const packageJson = parsePackageJson(rootDir, readFile);
  const doctorEnv = loadDoctorEnv(rootDir, exists, readFile, options.env ?? process.env);
  const envExample = parseEnvExample(rootDir, exists, readFile);

  const checks: DeliveryDoctorCheck[] = [
    ...REQUIRED_FILES.map((relativePath) => fileStatus(rootDir, relativePath, exists)),
    ...REQUIRED_PACKAGE_SCRIPTS.map((scriptName) => packageScriptStatus(packageJson, scriptName)),
    dockerComposeStatus(rootDir, exists),
    sampleTestStatus(rootDir, exists),
    sensitiveSampleStatus(rootDir, exists, readFile),
    freshCloneStatus(rootDir, listDirectory),
    sourceIntakeSetupDiagnosticDocStatus(rootDir, exists, readFile),
    sourceIntakeProofPackageStaticAssetsStatus(rootDir, exists, readFile),
    sourceIntakeLadderContractStatus(rootDir, exists, readFile),
    sourceIntakeForbiddenActionBoundaryStatus(rootDir, exists, readFile),
    qwenCredentialStatus(doctorEnv),
    chinaRegionResidencyStatus(regionProfile, doctorEnv),
    chinaNpmRegistryStatus(regionProfile, rootDir, exists, doctorEnv),
    chinaDockerMirrorGuidanceStatus(rootDir, exists, readFile),
    asrChinaBoundaryStatus(regionProfile, doctorEnv),
    chinaProfileStatus(envExample),
    asrOpenAIOnlyStatus(envExample),
    connectorTokenSecretStatus(envExample),
  ];

  const counts = countStatuses(checks);

  return {
    version: "delivery_engineer_golden_path_doctor_v1",
    boundary: "read_only_local_repo_static_check",
    regionProfile,
    passed: counts.fail === 0,
    counts,
    checks,
    nextCommands: [
      "npm run delivery:doctor",
      "npm run delivery:doctor -- --region cn",
      "node templates/signal-first-mile/run-first-change-proof.js templates/signal-first-mile/selector-input.sample.json /tmp/helm-sfm-first-change-proof",
      "npm run eval:signal-first-mile-quality",
      "npm run pack:fixture-check",
      "npm run eval:headless-signal-interface",
      "npm run eval:operating-signal-flow",
      "npm run check:public-release",
      "npm run self-check",
      "npm run check:boundaries",
    ],
  };
}
