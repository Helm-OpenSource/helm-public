#!/usr/bin/env tsx
/**
 * Public upgrade-note guard (`helm.upgrade-note/v1`).
 *
 * Every Prisma migration directory added after the frozen baseline must ship a
 * public upgrade note at `prisma/upgrade-notes/<migration directory>.json`, so a
 * self-hosted operator can tell before upgrading whether the migration alters an
 * existing table, which MySQL algorithm / lock it implies, whether a rollback
 * script exists, and how to verify it. Format and contributor guide:
 * prisma/upgrade-notes/README.md (中文) / README.en.md (English).
 *
 * This is a whole-tree invariant, not a PR diff: it holds on pull requests and on
 * pushes to main alike. The baseline (`scripts/upgrade-notes-baseline.json`)
 * lists the migrations that existed when the guard landed; it may only shrink
 * (a backfilled note removes its entry). Adding a new migration to the baseline
 * instead of writing a note is not caught here and must be refused in review.
 *
 * Notes are public: they carry generic MySQL facts only. Deployment facts,
 * production measurements and approvals belong in each deployment's private
 * repository; `check:public-release` scans this directory like any other path.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

export const MIGRATIONS_DIR = "prisma/migrations";
export const NOTES_DIR = "prisma/upgrade-notes";
export const BASELINE_PATH = "scripts/upgrade-notes-baseline.json";
const GUIDE_PATH = "prisma/upgrade-notes/README.md";

const nonEmpty = z.string().trim().min(1);
const bilingual = z.strictObject({ zh: nonEmpty, en: nonEmpty });

const ddlEntry = z.strictObject({
  table: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  existingTable: z.boolean(),
  // CREATE: new object; VIEW / TRIGGER: definition only; DATA: row writes, no DDL.
  algorithm: z.enum(["INSTANT", "INPLACE", "COPY", "CREATE", "VIEW", "TRIGGER", "DATA"]),
  lock: z.enum(["NONE", "SHARED", "EXCLUSIVE"]),
  rebuild: z.boolean(),
});

const upgradeNote = z.strictObject({
  schema: z.literal("helm.upgrade-note/v1"),
  migration: nonEmpty,
  summary: bilingual,
  ddl: z.array(ddlEntry).min(1),
  rollback: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("sql"),
      path: z.string().regex(/^prisma\/rollback\/[A-Za-z0-9_-]+\.sql$/),
    }),
    z.strictObject({ kind: z.literal("forward-only"), reason: bilingual }),
  ]),
  order: z.enum(["migrate-before-code", "code-before-migrate", "independent"]),
  env: z.array(
    z.strictObject({
      key: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
      codeDefault: z.string(),
      enablePrerequisites: z.array(bilingual),
    }),
  ),
  verification: z.array(bilingual).min(1),
});

export type UpgradeNote = z.infer<typeof upgradeNote>;

const baselineFile = z.strictObject({
  schema: z.literal("helm.upgrade-note-baseline/v1"),
  note: nonEmpty,
  migrations: z.array(nonEmpty),
});

export type UpgradeNoteRule =
  | "upgrade-notes:missing-note"
  | "upgrade-notes:invalid-json"
  | "upgrade-notes:invalid-format"
  | "upgrade-notes:name-mismatch"
  | "upgrade-notes:orphan-note"
  | "upgrade-notes:rollback-missing"
  | "upgrade-notes:inconsistent-ddl"
  | "upgrade-notes:baseline-invalid"
  | "upgrade-notes:baseline-stale"
  | "upgrade-notes:baseline-has-note";

export type UpgradeNoteViolation = {
  readonly rule: UpgradeNoteRule;
  readonly path: string;
  readonly detail: string;
};

export type UpgradeNoteReport = {
  readonly migrations: number;
  readonly baselined: number;
  readonly notes: number;
  readonly violations: ReadonlyArray<UpgradeNoteViolation>;
};

function listDirectories(absoluteDir: string): string[] {
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir)
    .filter((entry) => statSync(path.join(absoluteDir, entry)).isDirectory())
    .sort();
}

function readJson(absolutePath: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(absolutePath, "utf8")) };
  } catch {
    return { ok: false };
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function readBaseline(repoRoot: string): {
  migrations: Set<string>;
  violations: UpgradeNoteViolation[];
} {
  const invalid = (detail: string) => ({
    migrations: new Set<string>(),
    violations: [{ rule: "upgrade-notes:baseline-invalid" as const, path: BASELINE_PATH, detail }],
  });
  const raw = readJson(path.join(repoRoot, BASELINE_PATH));
  if (!raw.ok) return invalid("missing or not valid JSON");
  const parsed = baselineFile.safeParse(raw.value);
  if (!parsed.success) return invalid(formatIssues(parsed.error));
  const list = parsed.data.migrations;
  const sortedUnique = [...new Set(list)].sort();
  if (sortedUnique.length !== list.length || sortedUnique.some((name, i) => name !== list[i])) {
    return invalid("migrations must be sorted and unique");
  }
  return { migrations: new Set(list), violations: [] };
}

/** Text-determinable consistency only; whether MySQL really rebuilds is proven by rehearsal, not here. */
function ddlConsistency(note: UpgradeNote): string[] {
  const problems: string[] = [];
  note.ddl.forEach((entry, index) => {
    if (entry.algorithm === "CREATE" && entry.existingTable) {
      problems.push(`ddl.${index}: algorithm CREATE cannot target an existing table`);
    }
    if (entry.algorithm === "COPY" && !entry.rebuild) {
      problems.push(`ddl.${index}: algorithm COPY rebuilds the table; rebuild must be true`);
    }
    if (entry.algorithm === "INSTANT" && (entry.rebuild || entry.lock !== "NONE")) {
      problems.push(`ddl.${index}: algorithm INSTANT implies rebuild false and lock NONE`);
    }
  });
  return problems;
}

function checkNote(
  repoRoot: string,
  fileName: string,
  migrations: ReadonlySet<string>,
  baseline: ReadonlySet<string>,
): UpgradeNoteViolation[] {
  const notePath = `${NOTES_DIR}/${fileName}`;
  const stem = fileName.slice(0, -".json".length);
  const violations: UpgradeNoteViolation[] = [];
  const at = (rule: UpgradeNoteRule, detail: string) => violations.push({ rule, path: notePath, detail });

  if (!migrations.has(stem)) {
    at("upgrade-notes:orphan-note", `no ${MIGRATIONS_DIR}/${stem}/ directory`);
  } else if (baseline.has(stem)) {
    at("upgrade-notes:baseline-has-note", `remove ${stem} from ${BASELINE_PATH} in the same change`);
  }

  const raw = readJson(path.join(repoRoot, notePath));
  if (!raw.ok) {
    at("upgrade-notes:invalid-json", "not valid JSON");
    return violations;
  }
  const parsed = upgradeNote.safeParse(raw.value);
  if (!parsed.success) {
    at("upgrade-notes:invalid-format", formatIssues(parsed.error));
    return violations;
  }
  const note = parsed.data;
  if (note.migration !== stem) {
    at("upgrade-notes:name-mismatch", `migration "${note.migration}" must equal the file name "${stem}"`);
  }
  if (note.rollback.kind === "sql" && !existsSync(path.join(repoRoot, note.rollback.path))) {
    at("upgrade-notes:rollback-missing", `${note.rollback.path} does not exist`);
  }
  for (const problem of ddlConsistency(note)) at("upgrade-notes:inconsistent-ddl", problem);
  return violations;
}

export function analyzeUpgradeNotes(repoRoot: string): UpgradeNoteReport {
  const migrations = listDirectories(path.join(repoRoot, MIGRATIONS_DIR));
  const migrationSet = new Set(migrations);
  const baseline = readBaseline(repoRoot);
  const violations: UpgradeNoteViolation[] = [...baseline.violations];

  for (const name of baseline.migrations) {
    if (!migrationSet.has(name)) {
      violations.push({
        rule: "upgrade-notes:baseline-stale",
        path: BASELINE_PATH,
        detail: `${name} has no ${MIGRATIONS_DIR}/ directory`,
      });
    }
  }

  const absoluteNotesDir = path.join(repoRoot, NOTES_DIR);
  const noteFiles = existsSync(absoluteNotesDir)
    ? readdirSync(absoluteNotesDir).filter((entry) => entry.endsWith(".json")).sort()
    : [];
  const noted = new Set(noteFiles.map((file) => file.slice(0, -".json".length)));
  for (const file of noteFiles) {
    violations.push(...checkNote(repoRoot, file, migrationSet, baseline.migrations));
  }

  for (const name of migrations) {
    if (!baseline.migrations.has(name) && !noted.has(name)) {
      violations.push({
        rule: "upgrade-notes:missing-note",
        path: `${MIGRATIONS_DIR}/${name}`,
        detail: `add ${NOTES_DIR}/${name}.json (format: ${GUIDE_PATH})`,
      });
    }
  }

  return {
    migrations: migrations.length,
    baselined: baseline.migrations.size,
    notes: noteFiles.length,
    violations,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = analyzeUpgradeNotes(process.cwd());
  if (report.violations.length === 0) {
    console.log(
      `upgrade-notes: PASS - ${report.migrations} migration(s): ${report.notes} with a public upgrade note, ${report.baselined} pre-existing in ${BASELINE_PATH}; notes state generic MySQL facts, not a deployment approval`,
    );
  } else {
    console.error(`upgrade-notes: FAIL - ${report.violations.length} violation(s); format: ${GUIDE_PATH}`);
    for (const violation of report.violations) {
      console.error(`- ${violation.path}: ${violation.rule} ${violation.detail}`);
    }
    process.exitCode = 1;
  }
}
