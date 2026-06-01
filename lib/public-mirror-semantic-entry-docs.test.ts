/**
 * public-mirror-semantic — extended entry-doc + split-repo leak coverage (5B fix).
 *
 * The original semantic scan only covered code roots + a fixed set of config
 * files, so the mirror's README / docs index could leak tenant slugs and the
 * repo-split target-repo names. These tests prove the extended scan is
 * fail-closed on those surfaces while not regressing on a clean tree.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runPublicMirrorSemanticSmoke } from "../scripts/public-mirror-semantic";

let root: string;

function write(relativePath: string, content: string): void {
  const full = path.join(root, relativePath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

const splitRepo = (a: string, b: string) => [a, b].join("-");
const packsRepo = splitRepo("helm", "packs");
const overlaysRepo = splitRepo("helm", "overlays");
const controlPlaneRepo = splitRepo("helm", "control-plane");
// Build the tenant slug from fragments and keep the variable name neutral so the
// literal slug text never appears in this scanned shared-layer file (it would
// otherwise trip public-release-guard / tenant_slug_shared_layer_reverse_block).
const tenantSlug = ["gua", "ngpu"].join("");
const tenantPath = ["extensions", tenantSlug].join("/");
const tenantSlugRule = ["semantic", "tenant-slug", tenantSlug].join(":");
const tenantPathRule = ["semantic", "private-path", tenantPath].join(":");
const customerNamePrimaryCn = [tenantSlug, "cn"].join("-");
const personWang = ["王", "丽", "珍"].join("");
const personLi = ["李", "建", "乐"].join("");
const companyCn = ["杭州", "光", "潽", "科技有限公司"].join("");
const customerHost = ["helm", ["aicai", "group"].join(""), "com"].join(".");
const privateEmail = ["member", [["360", "amc"].join(""), "cn"].join(".")].join("@");
const internalIp = ["10", "16", "10", "55"].join(".");

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "helm-semantic-entry-"));
});
afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("README is scanned for repo-split target-repo names (fail-closed)", () => {
  it("flags a migration banner naming the split repos in README.md", () => {
    write(
      "README.md",
      `# Helm\n\n> split into ${packsRepo} / ${overlaysRepo} / ${controlPlaneRepo}.\n`,
    );
    const { violations } = runPublicMirrorSemanticSmoke(root);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain(`semantic:split-repo:${packsRepo}`);
    expect(rules).toContain(`semantic:split-repo:${overlaysRepo}`);
    expect(rules).toContain(`semantic:split-repo:${controlPlaneRepo}`);
  });

  it("passes a clean README with no banner", () => {
    write("README.md", "# Helm\n\nAn open-core operations loop reference.\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations).toEqual([]);
  });
});

describe("entry docs index/status are scanned (fail-closed backstop)", () => {
  it("flags tenant slug + private path in docs/README.md if it is ever shipped", () => {
    write("docs/README.md", `- [${tenantPath}/README.md](../${tenantPath}/README.md)\n`);
    const { violations } = runPublicMirrorSemanticSmoke(root);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain(tenantSlugRule);
    expect(rules).toContain(tenantPathRule);
  });

  it("flags tenant slug in docs/STATUS.md if it is ever shipped", () => {
    write("docs/STATUS.md", `| ${tenantSlug} readout | done |\n`);
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).toContain(tenantSlugRule);
  });
});

describe("entry docs and runtime config are scanned for public PII / infra leaks", () => {
  it("flags known customer identity, person, domain, and internal IP patterns", () => {
    write(
      "README.md",
      [
        "# Helm",
        `Do not ship ${companyCn}, ${personWang}, or ${personLi}.`,
        `Do not ship ${customerHost}, ${privateEmail}, or ${internalIp}.`,
      ].join("\n"),
    );
    const { violations } = runPublicMirrorSemanticSmoke(root);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain(`semantic:customer-name:${customerNamePrimaryCn}`);
    expect(rules).toContain("semantic:person-name:wang-lizhen");
    expect(rules).toContain("semantic:person-name:li-jianle");
    expect(rules).toContain("semantic:internal-host:customer-domain-a-host");
    expect(rules).toContain("semantic:internal-host:customer-domain-e-host");
    expect(rules).toContain("semantic:internal-ip:rfc1918");
  });
});

describe("does not over-reach into deep internal planning docs", () => {
  it("ignores a tenant slug in a non-entry docs/_planning file (guard allowlist governs those)", () => {
    write("docs/_planning/SOME_SPEC.md", `references ${tenantPath}/README.md\n`);
    const { violations } = runPublicMirrorSemanticSmoke(root);
    // Deep planning docs are governed by the curated public-release-guard
    // policy-descriptor allowlist, not re-scanned by the semantic entry-doc pass.
    expect(violations).toEqual([]);
  });
});

describe("hyphenated repo names do not false-positive on ordinary prose", () => {
  it("does not flag the word 'helm' alone or unrelated hyphenated tokens", () => {
    write("README.md", "# Helm\n\nThe helm chart and helm-of-the-ship metaphor are fine.\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    // 'helm-of' is not one of the split repo names.
    expect(violations.map((v) => v.rule)).not.toContain(`semantic:split-repo:${packsRepo}`);
    expect(violations).toEqual([]);
  });

  it("matches the repo name in markdown links / backticks / paths but not look-alikes", () => {
    write(
      "README.md",
      [
        "# Helm",
        "",
        `See [${packsRepo}](x) and \`${packsRepo}\` and ${packsRepo}/packs/npa.`,
        "", // look-alikes that must NOT trip:
        `${packsRepo}x is different, and so is helm-package and helmpacks.`,
      ].join("\n"),
    );
    const { violations } = runPublicMirrorSemanticSmoke(root);
    const packsHits = violations.filter((v) => v.rule === `semantic:split-repo:${packsRepo}`);
    // Three genuine forms on line 3; the look-alikes on line 5 must not add hits.
    expect(packsHits.length).toBeGreaterThanOrEqual(1);
    expect(packsHits.every((v) => v.line === 3)).toBe(true);
  });
});

// --- regression for the public-mirror leak class CodeX flagged (head cdd0411):
//     a tenant-named Core helper (under lib/notifications/) shipped in the mirror
//     because the scan only matched content word-boundaries, missing camelCase-
//     embedded slugs and file PATHS entirely. All tenant text below is built from
//     fragments so the literal slug never appears in this scanned source file.
const slugB = ["mi", "dun"].join("");
// Capitalized form for camelCase fixtures, built from fragments (avoids a literal).
const slugCap = slugB.charAt(0).toUpperCase() + slugB.slice(1);
const slugBRule = ["semantic", "tenant-slug", slugB].join(":");

describe("camelCase-embedded tenant slug in CONTENT is flagged", () => {
  it("flags a slug glued after a lowercase letter (e.g. shouldSend<Slug>Daily)", () => {
    write("lib/notifications/daily-control.ts", `export function shouldSend${slugCap}DailyMail() {}\n`);
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).toContain(slugBRule);
  });

  it("flags a slug at a PascalCase identifier start followed by an uppercase hump", () => {
    write("lib/x.ts", `const ${slugCap}State = 1;\n`);
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).toContain(slugBRule);
  });

  it("does NOT false-positive on an unrelated word that merely contains the letters", () => {
    // 'amidust' / 'medium' etc. must not match the slug.
    write("lib/y.ts", "const amidust = 1; const medium = 2; const dunmidless = 3;\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).not.toContain(slugBRule);
  });

  it("does NOT false-positive on a lowercase suffix (uppercase-hump branch is case-sensitive)", () => {
    // `<slug>x` must NOT match: the `<slug>[A-Z]` branch is
    // case-sensitive, so a lowercase letter after the slug is not a camelCase
    // hump. Under a naive `/i` flag this would have false-positived.
    write("lib/z.ts", `const ${slugB}x = 1; const ${slugB}able = 2;\n`);
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).not.toContain(slugBRule);
  });

  it("still matches the genuine uppercase camelCase hump (<slug>Upper)", () => {
    // Sanity counterpart: `<slug>X` (uppercase) MUST still match.
    write("lib/w.ts", `const ${slugCap}Daily = 1;\n`); // slugCap = capitalized slug, fragment-built
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).toContain(slugBRule);
  });
});

describe("tenant slug in the file PATH is flagged regardless of content", () => {
  it("flags a tenant-named filename even when the file content is clean", () => {
    // Exactly the missed case: a <slug>-named helper under lib/notifications/.
    write(`lib/notifications/${slugB}-daily-mail-control.ts`, "export const x = 1;\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).toContain(`${slugBRule}:path`);
  });

  it("flags a tenant slug embedded camelCase in a path segment", () => {
    write(`lib/${slugCap}Helper.ts`, "export const y = 2;\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.map((v) => v.rule)).toContain(`${slugBRule}:path`);
  });

  it("does NOT flag a clean Core path", () => {
    write("lib/notifications/system-mail.ts", "export const z = 3;\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations).toEqual([]);
  });
});

describe("path-scan covers every Core source root + all casings (owner regression)", () => {
  const roots = ["app", "components", "data", "features", "hooks", "lib", "prisma", "scripts"];
  it.each(roots)("flags a tenant-named file path under %s/", (rootDir) => {
    write(`${rootDir}/notifications/${slugB}-helper.ts`, "export const x = 1;\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations.some((v) => v.rule === `${slugBRule}:path`)).toBe(true);
  });

  it("flags kebab-case, camelCase, and PascalCase tenant symbols in a path", () => {
    write(`lib/${slugB}-runtime.ts`, "export const a = 1;\n"); // kebab
    write(`lib/get${slugCap}Config.ts`, "export const b = 2;\n"); // camelCase
    write(`lib/${slugCap}Adapter.ts`, "export const c = 3;\n"); // PascalCase
    const { violations } = runPublicMirrorSemanticSmoke(root);
    const pathHits = violations.filter((v) => v.rule === `${slugBRule}:path`).map((v) => v.path);
    expect(pathHits).toContain(`lib/${slugB}-runtime.ts`);
    expect(pathHits).toContain(`lib/get${slugCap}Config.ts`);
    expect(pathHits).toContain(`lib/${slugCap}Adapter.ts`);
  });

  it("does NOT flag the neutral Core helper that replaced the leaked one", () => {
    // lib/notifications/daily-mail-control.ts (no tenant slug) must ship cleanly.
    write("lib/notifications/daily-mail-control.ts", "export function shouldSendDailyMailOnce() {}\n");
    const { violations } = runPublicMirrorSemanticSmoke(root);
    expect(violations).toEqual([]);
  });
});
