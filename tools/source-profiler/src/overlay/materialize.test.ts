import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { materializeOverlayDraft } from "./materialize";
import type { OverlayPatchDraft } from "../contract/overlay";

function draft(overlayRoot: string): OverlayPatchDraft {
  return {
    schemaVersion: "helm.source-profiler.overlay-draft.v1",
    tenantKey: "acme",
    extensionSlug: "acme-crm",
    overlayRoot,
    files: [
      {
        path: "tenants/acme/extensions/acme-crm/extension.manifest.json",
        intent: "extension_manifest_patch",
        content: '{ "slug": "acme-crm" }\n',
      },
    ],
    materialized: false,
  };
}

function tmp(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("materializeOverlayDraft", () => {
  it("writes files under a valid overlay root with a marker", () => {
    const repo = tmp("sp-repo-");
    const overlay = tmp("sp-overlay-");
    try {
      writeFileSync(path.join(overlay, "AGENTS.md"), "# overlay\n");
      const result = materializeOverlayDraft({
        draft: draft(overlay),
        overlayRoot: overlay,
        sourceRepoRoot: repo,
        cwd: repo,
      });
      expect(result.writtenFiles).toContain(
        "tenants/acme/extensions/acme-crm/extension.manifest.json",
      );
      expect(existsSync(path.join(overlay, result.writtenFiles[0]))).toBe(true);
      expect(readFileSync(path.join(overlay, result.writtenFiles[0]), "utf8")).toContain("acme-crm");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(overlay, { recursive: true, force: true });
    }
  });

  it("refuses to write inside the source repo working tree", () => {
    const repo = tmp("sp-repo2-");
    try {
      const overlay = path.join(repo, "overlays");
      mkdirSync(overlay, { recursive: true });
      writeFileSync(path.join(overlay, "AGENTS.md"), "# overlay\n");
      expect(() =>
        materializeOverlayDraft({ draft: draft(overlay), overlayRoot: overlay, sourceRepoRoot: repo, cwd: repo }),
      ).toThrow(/source repo working tree/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("refuses a target that is not an overlay root", () => {
    const repo = tmp("sp-repo3-");
    const overlay = tmp("sp-overlay3-");
    try {
      expect(() =>
        materializeOverlayDraft({ draft: draft(overlay), overlayRoot: overlay, sourceRepoRoot: repo, cwd: repo }),
      ).toThrow(/overlay root/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(overlay, { recursive: true, force: true });
    }
  });

  it("does not clobber a non-empty target without force", () => {
    const repo = tmp("sp-repo4-");
    const overlay = tmp("sp-overlay4-");
    try {
      writeFileSync(path.join(overlay, "AGENTS.md"), "# overlay\n");
      materializeOverlayDraft({ draft: draft(overlay), overlayRoot: overlay, sourceRepoRoot: repo, cwd: repo });
      expect(() =>
        materializeOverlayDraft({ draft: draft(overlay), overlayRoot: overlay, sourceRepoRoot: repo, cwd: repo }),
      ).toThrow(/already exists/);
      // force overwrites
      expect(() =>
        materializeOverlayDraft({
          draft: draft(overlay),
          overlayRoot: overlay,
          sourceRepoRoot: repo,
          cwd: repo,
          force: true,
        }),
      ).not.toThrow();
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(overlay, { recursive: true, force: true });
    }
  });
});
