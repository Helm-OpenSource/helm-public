/**
 * Source Profiler — `profile` command.
 *
 * Loads the scope manifest (or a default rooted at --source), runs the
 * deterministic profiler, optionally introspects a DB catalog snapshot
 * (catalog-only, no rows), optionally runs the AI overlay (advisory candidates
 * only), writes a user-private run directory, and optionally emits a redacted
 * export and an overlay draft (materializing only when an overlay root is given
 * and the guard passes).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseScopeManifest, defaultScopeManifest, type ScopeManifest } from "../contract/scope-manifest";
import { runProfile, type ProfileResult } from "../profiler/profile";
import { proposeMappings } from "../profiler/mapping-proposer";
import { buildReviewPacket } from "../review/review-packet";
import { redactReviewPacket } from "../review/redact";
import { buildOverlayDraft } from "../overlay/overlay-draft";
import { materializeOverlayDraft } from "../overlay/materialize";
import { runAiOverlay } from "../ai/overlay";
import { parseDbCatalogSnapshot } from "../db/types";
import { introspectFromSnapshot } from "../db/introspect";
import { catalogToDiscoveredObjects } from "../db/catalog-to-objects";
import type { AiProviderKind } from "../ai/types";
import type { ReviewPacket } from "../contract/review-packet";
import type { OverlayPatchDraft } from "../contract/overlay";
import type { SignalMappingCandidate } from "../contract/mapping";
import type { CodeScanSummary } from "../contract/code-scan";
import type { SchemaIntrospectionSummary } from "../contract/schema-introspection";
import type { AuditEntry, SourceProfileRun } from "../contract/run";
import { shortHash } from "../util/hash";

export type ProfileCommandInput = {
  cwd: string;
  scopePath?: string;
  source?: string;
  output?: string;
  workspace?: string;
  redact?: boolean;
  emitOverlayDraft?: boolean;
  overlayRoot?: string;
  tenant?: string;
  extensionSlug?: string;
  force?: boolean;
  aiProvider?: AiProviderKind;
  aiConsent?: boolean;
  /** Path to a catalog snapshot JSON (information_schema/pragma dump, no rows). */
  dbCatalog?: string;
  /** Repo root that must not contain the overlay root. Defaults to cwd. */
  sourceRepoRoot?: string;
  now?: () => Date;
};

export type ProfileCommandResult = {
  runDir: string;
  result: ProfileResult;
  reviewPacket: ReviewPacket;
  artifactRefs: string[];
  overlayDraft?: OverlayPatchDraft;
  materializedFiles?: string[];
  aiCandidateCount?: number;
  dbTableCount?: number;
};

export async function runProfileCommand(input: ProfileCommandInput): Promise<ProfileCommandResult> {
  const { cwd, scopePath, source, output, now } = input;
  const clock = now ?? (() => new Date());

  const manifest = loadManifest({ cwd, scopePath, source });
  const rootAbs = path.resolve(cwd, manifest.root);
  if (!existsSync(rootAbs)) {
    throw new Error(`source root does not exist: ${rootAbs}`);
  }

  const result = runProfile({ rootAbs, manifest, now });
  const candidates: SignalMappingCandidate[] = [...result.candidates];
  const audit: AuditEntry[] = [...result.run.audit];
  const modalities = [...result.run.modalities];
  let codeScan: CodeScanSummary = result.codeScan;

  const outputDir = path.resolve(cwd, output ?? manifest.output.dir);
  const stamp = clock().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(outputDir, `${stamp}-${shortHash(result.run.runId)}`);
  mkdirSync(runDir, { recursive: true });

  const artifactRefs = ["run.json", "code-scan.json", "mapping-candidates.json"];

  // Optional DB catalog introspection (catalog-only, no rows).
  let schemaIntrospection: SchemaIntrospectionSummary | undefined;
  let dbTableCount: number | undefined;
  if (input.dbCatalog) {
    const allowlist = { schemas: manifest.dbCatalog.schemas, tables: manifest.dbCatalog.tables };
    if (allowlist.schemas.length === 0 && allowlist.tables.length === 0) {
      throw new Error("--db-catalog requires a schema/table allowlist in the scope manifest (dbCatalog.schemas/tables)");
    }
    const snapshotAbs = path.resolve(cwd, input.dbCatalog);
    const snapshot = parseDbCatalogSnapshot(JSON.parse(readFileSync(snapshotAbs, "utf8")));
    const introspected = introspectFromSnapshot(snapshot, allowlist);
    schemaIntrospection = introspected.summary;
    dbTableCount = introspected.summary.tables.length;
    for (const w of introspected.warnings) {
      audit.push({ at: clock().toISOString(), phase: "db_catalog", message: w, level: "warn" });
    }
    const dbObjects = catalogToDiscoveredObjects(introspected.summary);
    const dbCandidates = dbObjects.flatMap((o) => proposeMappings(o));
    candidates.push(...dbCandidates);
    codeScan = { ...codeScan, objects: [...codeScan.objects, ...dbObjects] };
    modalities.push("db_catalog");
    audit.push({
      at: clock().toISOString(),
      phase: "db_catalog",
      level: "info",
      message: `introspected ${dbTableCount} table(s) (${introspected.excludedTables.length} excluded by allowlist); ${dbCandidates.length} candidate(s)`,
    });
  }

  // Optional AI overlay (advisory, candidate-only). Remote sees redacted only.
  let aiCandidateCount: number | undefined;
  if (input.aiProvider) {
    const seedRun: SourceProfileRun = { ...result.run, audit, modalities };
    const seedPacket = buildReviewPacket({
      run: seedRun,
      codeScan,
      candidates,
      schemaIntrospection,
      source: manifest.root,
      workspace: input.workspace,
    });
    const ai = await runAiOverlay({
      packet: seedPacket,
      providerKind: input.aiProvider,
      consent: input.aiConsent ?? false,
      now,
    });
    candidates.push(...ai.candidates);
    audit.push(...ai.audit);
    aiCandidateCount = ai.candidates.length;
    writeFileSync(path.join(runDir, "ai-prompt-preview.txt"), `${ai.promptPreview}\n`, "utf8");
    artifactRefs.push("ai-prompt-preview.txt");
  }

  const run: SourceProfileRun = { ...result.run, audit, modalities };
  const reviewPacket = buildReviewPacket({
    run,
    codeScan,
    candidates,
    schemaIntrospection,
    source: manifest.root,
    workspace: input.workspace,
  });

  writeJson(path.join(runDir, "code-scan.json"), codeScan);
  writeJson(path.join(runDir, "mapping-candidates.json"), candidates);
  writeJson(path.join(runDir, "review-packet.json"), reviewPacket);
  artifactRefs.push("review-packet.json");

  if (input.redact) {
    writeJson(path.join(runDir, "review-packet.redacted.json"), redactReviewPacket(reviewPacket));
    artifactRefs.push("review-packet.redacted.json");
  }

  let overlayDraft: OverlayPatchDraft | undefined;
  let materializedFiles: string[] | undefined;
  if (input.emitOverlayDraft) {
    if (!input.tenant || !input.extensionSlug) {
      throw new Error("--emit-overlay-draft requires --tenant and --extension-slug");
    }
    overlayDraft = buildOverlayDraft({
      packet: reviewPacket,
      tenantKey: input.tenant,
      extensionSlug: input.extensionSlug,
      overlayRoot: input.overlayRoot ?? "(not-materialized)",
    });

    if (input.overlayRoot) {
      const materialized = materializeOverlayDraft({
        draft: overlayDraft,
        overlayRoot: input.overlayRoot,
        sourceRepoRoot: input.sourceRepoRoot ?? cwd,
        cwd,
        force: input.force,
      });
      materializedFiles = materialized.writtenFiles;
      overlayDraft = { ...overlayDraft, materialized: true };
    }
    writeJson(path.join(runDir, "overlay-draft.json"), overlayDraft);
    artifactRefs.push("overlay-draft.json");
  }

  const runRecord = { ...run, artifactRefs };
  writeJson(path.join(runDir, "run.json"), runRecord);

  return {
    runDir,
    result: { ...result, run: runRecord, codeScan, candidates },
    reviewPacket,
    artifactRefs,
    overlayDraft,
    materializedFiles,
    aiCandidateCount,
    dbTableCount,
  };
}

function loadManifest({
  cwd,
  scopePath,
  source,
}: Pick<ProfileCommandInput, "cwd" | "scopePath" | "source">): ScopeManifest {
  if (scopePath) {
    const abs = path.resolve(cwd, scopePath);
    if (existsSync(abs)) {
      const parsed = parseScopeManifest(JSON.parse(readFileSync(abs, "utf8")));
      return source ? { ...parsed, root: source } : parsed;
    }
  }
  return defaultScopeManifest(source ?? ".");
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
