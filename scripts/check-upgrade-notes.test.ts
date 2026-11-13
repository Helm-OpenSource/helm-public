import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeUpgradeNotes,
  BASELINE_CUTOFF,
  BASELINE_MAX_ENTRIES,
  BASELINE_PATH,
  MIGRATIONS_DIR,
  NOTES_DIR,
} from "./check-upgrade-notes";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const OLD = "20200101000000_example_old_change";
const NEW = "20990102000000_example_new_change";

function write(root: string, relativePath: string, content: string): void {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function fixture(options: { baseline?: unknown; migrations?: string[] } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "upgrade-notes-"));
  roots.push(root);
  for (const name of options.migrations ?? [OLD, NEW]) {
    write(root, `${MIGRATIONS_DIR}/${name}/migration.sql`, "SELECT 1;\n");
  }
  write(root, `${MIGRATIONS_DIR}/migration_lock.toml`, 'provider = "mysql"\n');
  write(root, "prisma/rollback/20990102_rollback_example_new_change.sql", "SELECT 1;\n");
  const baseline = options.baseline ?? {
    schema: "helm.upgrade-note-baseline/v1",
    note: "fixture",
    migrations: [OLD],
  };
  write(root, BASELINE_PATH, JSON.stringify(baseline));
  return root;
}

function validNote(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "helm.upgrade-note/v1",
    migration: NEW,
    summary: { zh: "为示例表新增一列。", en: "Adds one column to the example table." },
    ddl: [{ table: "ExampleTable", existingTable: true, algorithm: "INSTANT", lock: "NONE", rebuild: false }],
    rollback: { kind: "sql", path: "prisma/rollback/20990102_rollback_example_new_change.sql" },
    order: "migrate-before-code",
    env: [
      {
        key: "HELM_EXAMPLE_FEATURE_ENABLED",
        codeDefault: "false",
        enablePrerequisites: [{ zh: "迁移已应用。", en: "The migration is applied." }],
      },
    ],
    verification: [{ zh: "确认新列存在。", en: "Confirm the new column exists." }],
    ...overrides,
  };
}

function writeNote(root: string, note: unknown, name = NEW): void {
  write(root, `${NOTES_DIR}/${name}.json`, typeof note === "string" ? note : JSON.stringify(note));
}

function rules(root: string): string[] {
  return analyzeUpgradeNotes(root).violations.map((violation) => violation.rule);
}

describe("check-upgrade-notes", () => {
  it("passes on the real repository tree (baseline equals the current migrations or notes exist)", () => {
    const report = analyzeUpgradeNotes(process.cwd());
    expect(report.violations).toEqual([]);
    expect(report.migrations).toBeGreaterThan(0);
  });

  it.each(["README.md", "README.en.md"])("keeps the %s example valid against the guard", (guide) => {
    const text = readFileSync(path.join(process.cwd(), NOTES_DIR, guide), "utf8");
    const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(text)?.[1] ?? "null") as { migration: string };
    const root = fixture({ migrations: [example.migration] });
    write(root, BASELINE_PATH, JSON.stringify({ schema: "helm.upgrade-note-baseline/v1", note: "fixture", migrations: [] }));
    write(root, "prisma/rollback/20990101_rollback_example_add_column.sql", "SELECT 1;\n");
    writeNote(root, example, example.migration);
    expect(rules(root)).toEqual([]);
  });

  it("accepts a baselined migration plus a new migration with a valid note", () => {
    const root = fixture();
    writeNote(root, validNote());
    expect(analyzeUpgradeNotes(root)).toMatchObject({ migrations: 2, baselined: 1, notes: 1, violations: [] });
  });

  it("fails a new migration that has no note and names the file to add", () => {
    const root = fixture();
    const [violation, ...rest] = analyzeUpgradeNotes(root).violations;
    expect(rest).toEqual([]);
    expect(violation).toMatchObject({ rule: "upgrade-notes:missing-note", path: `${MIGRATIONS_DIR}/${NEW}` });
    expect(violation?.detail).toContain(`${NOTES_DIR}/${NEW}.json`);
  });

  it("accepts a forward-only rollback with a bilingual reason", () => {
    const root = fixture();
    writeNote(root, validNote({ rollback: { kind: "forward-only", reason: { zh: "只新增数据。", en: "Data only." } } }));
    expect(rules(root)).toEqual([]);
  });

  it.each([
    ["an unknown top-level key", validNote({ productionWindow: "night" })],
    ["an unknown ddl key", validNote({ ddl: [{ ...(validNote().ddl as object[])[0], rows: 10 }] })],
    ["an empty English summary", validNote({ summary: { zh: "摘要", en: " " } })],
    ["a missing Chinese summary", validNote({ summary: { en: "Summary" } })],
    ["a wrong schema", validNote({ schema: "helm.upgrade-note/v2" })],
    ["an algorithm outside the closed set", validNote({ ddl: [{ table: "T", existingTable: true, algorithm: "ONLINE", lock: "NONE", rebuild: false }] })],
    ["an empty ddl list", validNote({ ddl: [] })],
    ["no verification step", validNote({ verification: [] })],
    ["a rollback path outside prisma/rollback", validNote({ rollback: { kind: "sql", path: "scripts/rollback.sql" } })],
    ["a rollback path that climbs directories", validNote({ rollback: { kind: "sql", path: "prisma/rollback/../x.sql" } })],
    ["a lower-case env key", validNote({ env: [{ key: "lower_key", codeDefault: "", enablePrerequisites: [] }] })],
    ["an unknown key inside a bilingual text", validNote({ summary: { zh: "摘要", en: "Summary", fr: "Résumé" } })],
    ["an unknown key in a sql rollback", validNote({ rollback: { kind: "sql", path: "prisma/rollback/20990102_rollback_example_new_change.sql", note: "x" } })],
    ["an unknown key in a forward-only rollback", validNote({ rollback: { kind: "forward-only", reason: { zh: "只新增数据。", en: "Data only." }, path: "x" } })],
    ["an unknown key in an env entry", validNote({ env: [{ key: "HELM_EXAMPLE", codeDefault: "false", enablePrerequisites: [], productionValue: "true" }] })],
    ["an illegal table name", validNote({ ddl: [{ table: "bad-name;", existingTable: true, algorithm: "INPLACE", lock: "NONE", rebuild: false }] })],
    ["a missing env list", (() => { const note = validNote(); delete note.env; return note; })()],
  ])("rejects %s as invalid-format", (_label, note) => {
    const root = fixture();
    writeNote(root, note);
    expect(rules(root)).toEqual(["upgrade-notes:invalid-format"]);
  });

  it("rejects a note that is not JSON", () => {
    const root = fixture();
    writeNote(root, "{ not json");
    expect(rules(root)).toEqual(["upgrade-notes:invalid-json"]);
  });

  it("rejects a note whose migration field differs from its file name", () => {
    const root = fixture();
    writeNote(root, validNote({ migration: OLD }));
    expect(rules(root)).toEqual(["upgrade-notes:name-mismatch"]);
  });

  it("rejects a note with no migration directory", () => {
    const root = fixture();
    writeNote(root, validNote());
    writeNote(root, validNote({ migration: "20990103000000_example_typo" }), "20990103000000_example_typo");
    expect(rules(root)).toEqual(["upgrade-notes:orphan-note"]);
  });

  it("rejects a sql rollback whose file does not exist", () => {
    const root = fixture();
    writeNote(root, validNote({ rollback: { kind: "sql", path: "prisma/rollback/20990102_rollback_missing.sql" } }));
    expect(rules(root)).toEqual(["upgrade-notes:rollback-missing"]);
  });

  it.each([
    ["CREATE on an existing table", { table: "T", existingTable: true, algorithm: "CREATE", lock: "NONE", rebuild: false }],
    ["COPY without rebuild", { table: "T", existingTable: true, algorithm: "COPY", lock: "SHARED", rebuild: false }],
    ["INSTANT with a rebuild", { table: "T", existingTable: true, algorithm: "INSTANT", lock: "NONE", rebuild: true }],
    ["INSTANT with a lock", { table: "T", existingTable: true, algorithm: "INSTANT", lock: "SHARED", rebuild: false }],
  ])("rejects %s as inconsistent-ddl", (_label, entry) => {
    const root = fixture();
    writeNote(root, validNote({ ddl: [entry] }));
    expect(rules(root)).toEqual(["upgrade-notes:inconsistent-ddl"]);
  });

  it("accepts COPY with rebuild and CREATE on a new table", () => {
    const root = fixture();
    writeNote(
      root,
      validNote({
        ddl: [
          { table: "ExampleTable", existingTable: true, algorithm: "COPY", lock: "SHARED", rebuild: true },
          { table: "ExampleChild", existingTable: false, algorithm: "CREATE", lock: "NONE", rebuild: false },
        ],
      }),
    );
    expect(rules(root)).toEqual([]);
  });

  it("rejects a baseline entry without a migration directory", () => {
    const root = fixture({
      baseline: { schema: "helm.upgrade-note-baseline/v1", note: "fixture", migrations: ["20190101000000_gone", OLD] },
    });
    writeNote(root, validNote());
    expect(rules(root)).toEqual(["upgrade-notes:baseline-stale"]);
  });

  it("rejects a baselined migration that also has a note (backfill must drop the entry)", () => {
    const root = fixture();
    writeNote(root, validNote());
    writeNote(root, validNote({ migration: OLD }), OLD);
    expect(rules(root)).toEqual(["upgrade-notes:baseline-has-note"]);
  });

  it.each([
    ["unsorted", { schema: "helm.upgrade-note-baseline/v1", note: "fixture", migrations: [NEW, OLD] }],
    ["duplicated", { schema: "helm.upgrade-note-baseline/v1", note: "fixture", migrations: [OLD, OLD] }],
    ["an unknown key", { schema: "helm.upgrade-note-baseline/v1", note: "fixture", migrations: [OLD], extra: 1 }],
    ["a past-cutoff", { schema: "helm.upgrade-note-baseline/v1", note: "fixture", migrations: [OLD, `${BASELINE_CUTOFF}_later`] }],
    [
      "an oversized",
      {
        schema: "helm.upgrade-note-baseline/v1",
        note: "fixture",
        migrations: Array.from({ length: BASELINE_MAX_ENTRIES + 1 }, (_, i) => `2019${String(i).padStart(10, "0")}_x`),
      },
    ],
  ])("rejects a %s baseline and then treats every migration as unbaselined", (_label, baseline) => {
    const root = fixture({ baseline });
    writeNote(root, validNote());
    expect(rules(root)).toEqual(["upgrade-notes:baseline-invalid", "upgrade-notes:missing-note"]);
  });
});
