import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("codex infra pack", () => {
  it("keeps the root AGENTS and codex templates present", () => {
    const requiredFiles = [
      "AGENTS.md",
      "WORKING-CONTEXT.md",
      ".codex/config.toml",
      ".codex/hooks.json",
      "docs/codex/README.md",
      "docs/codex/batch_task_master_template.md",
      "docs/codex/definition_of_done.md",
      "docs/codex/release_checklist.md",
      "docs/codex/report_template_freeze.md",
      "docs/codex/report_template_sprint.md",
      "docs/codex/CODEX_INFRA_PACK_ALIGNMENT_REPORT.md",
      "docs/codex/CODEX_INFRA_PACK_SPRINT_1_REPORT.md",
      "scripts/codex-hooks/pre-bash-block-no-verify.cjs",
      "scripts/codex-hooks/pre-bash-git-push-reminder.cjs",
      "scripts/codex-hooks/pre-edit-config-protection.cjs",
      "scripts/codex-hooks/post-edit-design-quality-check.cjs",
      "scripts/codex-hooks/post-edit-debug-artifact-check.cjs",
      "scripts/codex-hooks/post-edit-accumulator.cjs",
      "scripts/codex-hooks/session-start-bootstrap.cjs",
      "scripts/codex-hooks/stop-validation-reminder.cjs",
    ];

    for (const relativePath of requiredFiles) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps the initial codex skills present", () => {
    const requiredFiles = [
      ".agents/skills/baseline-freeze/SKILL.md",
      ".agents/skills/readiness-sprint/SKILL.md",
      ".agents/skills/decision-first-page-refactor/SKILL.md",
      ".agents/skills/worker-skill-resource-binding/SKILL.md",
    ];

    for (const relativePath of requiredFiles) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps the AGENTS contract visible", () => {
    const content = read("AGENTS.md");
    const requiredSnippets = [
      "workspace-first",
      "membership-backed",
      "controlled-trial",
      "recommendation / commitment",
      "plugin runtime 仍没有真正 sandbox",
      "已成形但仍需下一层",
      "npm run db:reset",
      "npm run quality:regression",
    ];

    for (const snippet of requiredSnippets) {
      expect(content).toContain(snippet);
    }
  });

  it("keeps README and docs index pointed at codex infra entrypoints", () => {
    const readme = read("README.md");
    const docsReadme = read("docs/README.md");
    const codexReadme = read("docs/codex/README.md");
    const publicReadmeSnippets = [
      "WORKING-CONTEXT.md",
      "AGENTS.md",
      "docs/README.md",
    ];
    const sharedEntrySnippets = [
      "WORKING-CONTEXT.md",
      ".codex/config.toml",
      ".codex/hooks.json",
      "scripts/codex-hooks/",
      "docs/codex/README.md",
      "batch_task_master_template.md",
      "definition_of_done.md",
      "release_checklist.md",
      "report_template_freeze.md",
      "report_template_sprint.md",
      "CODEX_INFRA_PACK_ALIGNMENT_REPORT.md",
      "CODEX_INFRA_PACK_SPRINT_1_REPORT.md",
      ".agents/skills/",
    ];

    for (const snippet of publicReadmeSnippets) {
      expect(readme).toContain(snippet);
    }

    for (const snippet of sharedEntrySnippets) {
      expect(docsReadme).toContain(snippet);
    }

    const codexReadmeSnippets = [
      "WORKING-CONTEXT.md",
      ".codex/config.toml",
      ".codex/hooks.json",
      "scripts/codex-hooks/",
      "codex_hooks",
    ];

    for (const snippet of codexReadmeSnippets) {
      expect(codexReadme).toContain(snippet);
    }
  });
});
