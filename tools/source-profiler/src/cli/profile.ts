/**
 * Source Profiler — `profile` command.
 *
 * Loads the scope manifest (or a default rooted at --source), runs the
 * deterministic profiler, optionally runs the AI overlay (advisory candidates
 * only), writes a user-private run directory, and optionally emits a redacted
 * export and an overlay draft (materializing it only when an overlay root is
 * given and the guard passes).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseScopeManifest, defaultScopeManifest, type ScopeManifest } from "../contract/scope-manifest";
import { runProfile, type ProfileResult } from "../profiler/profile";
import { buildReviewPacket } from "../review/review-packet";
import { redactReviewPacket } from "../review/redact";
import { buildOverlayDraft } from "../overlay/overlay-draft";
import { materializeOverlayDraft } from "../overlay/materialize";
import { runAiOverlay } from "../ai/overlay";
import type { AiProviderKind } from "../ai/types";
import type { ReviewPacket } from "../contract/review-packet";
import type { OverlayPatchDraft } from "../contract/overlay";
import type { SignalMappingCandidate } from "../contract/mapping";
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
  const audit = [...result.run.audit];

  const outputDir = path.resolve(cwd, output ?? manifest.output.dir);
  const stamp = clock().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(outputDir, `${stamp}-${shortHash(result.run.runId)}`);
  mkdirSync(runDir, { recursive: true });

  const artifactRefs = ["run.json", "code-scan.json", "mapping-candidates.json"];

  // Optional AI overlay (advisory, candidate-only). Built from a deterministic
  // packet; remote providers see only the redacted prompt.
  let aiCandidateCount: number | undefined;
  if (input.aiProvider) {
    const seedPacket = buildReviewPacket({
      run: result.run,
      codeScan: result.codeScan,
      candidates: result.candidates,
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

  const run = { ...result.run, audit };
  const reviewPacket = buildReviewPacket({
    run,
    codeScan: result.codeScan,
    candidates,
    source: manifest.root,
    workspace: input.workspace,
  });

  writeJson(path.join(runDir, "code-scan.json"), result.codeScan);
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
    result: { ...result, run: runRecord, candidates },
    reviewPacket,
    artifactRefs,
    overlayDraft,
    materializedFiles,
    aiCandidateCount,
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
