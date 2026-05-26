import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  BiReportRow,
  BiReportSkillPack,
  BiReportSubscriptionConfig,
} from "@/lib/bi-report-skill/types";
import { findTenantExtensionManifestByExtensionKey, loadTenantExtensionManifest, resolveTenantExtensionRoot } from "@/lib/solution-extension-manifests";

type BiReportAssetSource = "extension";
type ResolveBiReportAssetInput = {
  extensionKey?: string;
  tenantKey?: string;
  extensionSlug?: string;
  skillKey?: string;
  skillDir?: string;
};

type ResolvedBiReportAssetLocation = {
  baseDir: string;
  source: BiReportAssetSource;
  extensionKey: string | null;
  tenantKey: string | null;
  extensionSlug: string | null;
};

function resolveRepoPath(inputPath: string) {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), inputPath);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(resolveRepoPath(filePath), "utf8");
  return JSON.parse(raw) as T;
}

async function readTextFile(filePath: string) {
  return readFile(resolveRepoPath(filePath), "utf8");
}

export function resolveBiReportSkillDir(input: ResolveBiReportAssetInput) {
  return resolveBiReportSkillLocation(input).baseDir;
}

export function resolveBiReportSkillLocation(input: ResolveBiReportAssetInput): ResolvedBiReportAssetLocation {
  if (input.skillDir) {
    return {
      baseDir: resolveRepoPath(input.skillDir),
      source: "extension",
      extensionKey: input.extensionKey ?? null,
      tenantKey: input.tenantKey ?? null,
      extensionSlug: input.extensionSlug ?? null,
    };
  }

  if (!input.skillKey) {
    throw new Error("loadBiReportSkillPack requires skillKey or skillDir");
  }

  const manifest = resolveBiReportExtensionManifest(input);

  return {
    baseDir: path.join(
      resolveTenantExtensionRoot({
        tenantKey: manifest.tenantKey,
        extensionSlug: manifest.extensionSlug,
      }),
      "report-skills",
      input.skillKey,
    ),
    source: "extension",
    extensionKey: manifest.extensionKey,
    tenantKey: manifest.tenantKey,
    extensionSlug: manifest.extensionSlug,
  };
}

export function resolveBiReportSubscriptionFile(input: ResolveBiReportAssetInput & { subscriptionFile?: string }) {
  if (input.subscriptionFile) {
    return resolveRepoPath(input.subscriptionFile);
  }

  const location = resolveBiReportSkillLocation(input);
  return path.join(location.baseDir, "subscription.example.json");
}

export async function loadBiReportSkillPack(
  input: ResolveBiReportAssetInput,
): Promise<BiReportSkillPack> {
  const { baseDir } = resolveBiReportSkillLocation(input);
  const [manifest, querySql, schema, metrics, resultCriteria, promptTemplate, messageTemplate] = await Promise.all([
    readJsonFile<BiReportSkillPack["manifest"]>(path.join(baseDir, "skill.json")),
    readTextFile(path.join(baseDir, "query.sql")),
    readJsonFile<BiReportSkillPack["schema"]>(path.join(baseDir, "schema.json")),
    readJsonFile<BiReportSkillPack["metrics"]>(path.join(baseDir, "metrics.json")),
    readJsonFile<BiReportSkillPack["resultCriteria"]>(path.join(baseDir, "result-criteria.json")),
    readTextFile(path.join(baseDir, "prompt.md")),
    readTextFile(path.join(baseDir, "message-template.md")),
  ]);

  return {
    baseDir,
    manifest,
    querySql: querySql.trim(),
    schema,
    metrics,
    resultCriteria,
    promptTemplate: promptTemplate.trim(),
    messageTemplate: messageTemplate.trim(),
  };
}

export async function loadBiReportSubscriptionFromFile(filePath: string) {
  return readJsonFile<BiReportSubscriptionConfig>(filePath);
}

export async function loadBiReportRowsFromFile(filePath: string) {
  const payload = await readJsonFile<{ rows?: BiReportRow[] } | BiReportRow[]>(filePath);
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload.rows) ? payload.rows : [];
}

function resolveBiReportExtensionManifest(input: ResolveBiReportAssetInput) {
  if (input.tenantKey && input.extensionSlug) {
    const manifest = loadTenantExtensionManifest({
      tenantKey: input.tenantKey,
      extensionSlug: input.extensionSlug,
    });
    if (input.extensionKey && manifest.extensionKey !== input.extensionKey) {
      throw new Error(
        `extension identity mismatch: ${input.extensionKey} does not match ${manifest.extensionKey}`,
      );
    }
    return manifest;
  }

  if (!input.extensionKey) {
    throw new Error(
      "loadBiReportSkillPack requires extensionKey or tenantKey + extensionSlug unless skillDir is provided",
    );
  }

  return findTenantExtensionManifestByExtensionKey(input.extensionKey);
}
