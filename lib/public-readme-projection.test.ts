/**
 * build-public-readme — README migration-banner strip projection (5B mirror leak fix).
 *
 * Proves the projection removes ONLY the repo-split "migration source" banner
 * (which names helm-packs / helm-overlays / helm-control-plane) and leaves the
 * rest of the README intact, with a fail-closed --check mode.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildPublicReadme,
  resolveReadmePath,
  stripReadmeBanner,
} from "../scripts/build-public-readme";

let fixtureRoot: string;

const BANNER =
  "> ⚠️ **本仓已冻结为迁移源（migration source）。** " +
  "拆分为 4 个目标仓：`helm-packs` / `helm-overlays` / `helm-control-plane`。";

const README_WITH_BANNER = [
  "> Language line",
  "",
  BANNER,
  "",
  "# Helm",
  "",
  "Generic open-core body that mentions nothing private.",
  "",
].join("\n");

function write(content: string): string {
  const p = resolveReadmePath(fixtureRoot);
  writeFileSync(p, content, "utf8");
  return p;
}
function read(): string {
  return readFileSync(resolveReadmePath(fixtureRoot), "utf8");
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-readme-proj-"));
});
afterEach(() => {
  rmSync(fixtureRoot, { force: true, recursive: true });
});

describe("stripReadmeBanner (pure)", () => {
  it("removes the migration-source banner and the blank line after it", () => {
    const { output, changed } = stripReadmeBanner(README_WITH_BANNER);
    expect(changed).toBe(true);
    expect(output).not.toContain("migration source");
    expect(output).not.toContain("helm-packs");
    expect(output).not.toContain("helm-control-plane");
    // Body preserved.
    expect(output).toContain("# Helm");
    expect(output).toContain("Generic open-core body");
    expect(output).toContain("> Language line");
  });

  it("is a no-op on a README with no banner", () => {
    const clean = "# Helm\n\nNothing private here.\n";
    const { output, changed } = stripReadmeBanner(clean);
    expect(changed).toBe(false);
    expect(output).toBe(clean);
  });

  it("strips an English-worded banner via the 'migration source' anchor", () => {
    const en = "> NOTE: this repo is frozen as a migration source — go to the split repos.\n\n# Helm\n";
    const { output, changed } = stripReadmeBanner(en);
    expect(changed).toBe(true);
    expect(output).not.toContain("migration source");
    expect(output).toContain("# Helm");
  });
});

describe("buildPublicReadme (projection)", () => {
  it("writes the stripped README and is idempotent", () => {
    write(README_WITH_BANNER);
    const first = buildPublicReadme({ repoRoot: fixtureRoot });
    expect(first.status).toBe("stripped-banner");
    expect(read()).not.toContain("migration source");

    const second = buildPublicReadme({ repoRoot: fixtureRoot });
    expect(second.status).toBe("already-clean");
  });

  it("--check fails (exit 1) when the banner is still present and does not mutate", () => {
    write(README_WITH_BANNER);
    const r = buildPublicReadme({ repoRoot: fixtureRoot, checkMode: true });
    expect(r.status).toBe("needs-strip");
    expect(r.exitCode).toBe(1);
    expect(read()).toContain("migration source"); // unchanged
  });

  it("--check passes (exit 0) once the README is clean", () => {
    write("# Helm\n\nClean.\n");
    const r = buildPublicReadme({ repoRoot: fixtureRoot, checkMode: true });
    expect(r.exitCode).toBe(0);
    expect(r.status).toBe("already-clean");
  });

  it("no-readme is a benign success", () => {
    const r = buildPublicReadme({ repoRoot: fixtureRoot });
    expect(r.status).toBe("no-readme");
    expect(r.exitCode).toBe(0);
  });
});
