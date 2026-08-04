#!/usr/bin/env tsx
/**
 * Conditional-update compare-and-swap guard.
 *
 * On MySQL, Prisma compiles a conditional `updateMany` into two statements:
 *
 *   SELECT `id` FROM `T` WHERE <predicate>
 *   UPDATE `T` SET ... WHERE `id` IN (?) AND 1=1
 *
 * The predicate is evaluated at READ time and dropped from the write, so the
 * affected-row count proves only that the row still exists — never that it was
 * still in the expected state. Reading that count as a compare-and-swap result
 * is therefore unsound: two concurrent callers both select the row and both
 * write. Measured on mysql:8.4, six concurrent claims passed a limit of three
 * and two concurrent adoptions of one record both succeeded; the mechanism was
 * confirmed with Prisma query logging.
 *
 * MariaDB can mask this: it raises error 1020 on the racing id-update, and a
 * retry helper that swallows 1020 serialises the callers by accident. Passing
 * tests on MariaDB are not evidence that the invariant holds.
 *
 * The sound alternatives are: one atomic `$executeRaw` UPDATE whose own WHERE
 * carries the pre-state, or a serialisable transaction that also takes an
 * explicit lock and issues the write on the transaction client.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD FLAGS
 * ---------------------------------------------------------------------------
 *
 * A call site is a finding when ALL of the following hold:
 *
 *   1. It is `<client>.<delegate>.updateMany({ where: {...}, ... })` whose
 *      affected-row count is consumed locally or returned to an unseen caller.
 *   2. Its `where` carries at least one STATE PREDICATE field (see below) —
 *      i.e. the caller is asserting a pre-state, not merely addressing a row.
 *   3. The result count is read as a decision: `x.count <op> <number>` for any
 *      of `=== !== == != < > <= >=`, or `!x.count`, anywhere in the enclosing
 *      lexical function.
 *   4. The site is NOT held by a serialisable transaction issued on the
 *      transaction client. Specifically, it is protected only when the call is
 *      lexically inside the callback argument of a `$transaction(...)` call,
 *      AND the receiver's root identifier is that callback's client parameter
 *      (`tx.`, not the ambient `db.`), AND the `$transaction` call carries
 *      `isolationLevel: ...Serializable`. Failing any of these yields a finding
 *      with a distinct `reason`:
 *        - `no-transaction` — no enclosing `$transaction` callback at all.
 *        - `client-from-parameter` — the receiver is bound by a parameter of an
 *          enclosing function, so the transaction (if any) is opened by a
 *          caller this guard cannot see lexically. Fail-closed: an unproven
 *          isolation level is not a proven one.
 *        - `ambient-client-inside-transaction` — inside a `$transaction`
 *          callback but issued on the ambient client, which runs on its own
 *          connection and is therefore NOT in the transaction.
 *        - `isolation-not-serializable` — inside a `$transaction` callback on
 *          the transaction client, but no `isolationLevel: ...Serializable`.
 *
 * ---------------------------------------------------------------------------
 * WHAT COUNTS AS A STATE PREDICATE (DERIVED, NOT GUESSED)
 * ---------------------------------------------------------------------------
 *
 * The primary source is `prisma/schema.prisma`, read at guard time. For each
 * model, a field is a state predicate when it is:
 *
 *   (a) ENUM-TYPED — the field's type is a name declared by an `enum` block in
 *       the schema and the field is not a list. An enum column is a closed set
 *       of lifecycle values by construction.
 *   (b) A NULLABLE `DateTime` WHOSE NAME ENDS IN `At` — nullability is itself
 *       the lifecycle signal: NULL means "this event has not happened yet", so
 *       `revokedAt: null` in a `where` is a pre-state assertion. Non-nullable
 *       stamps (`createdAt`, `updatedAt`) are excluded by the same rule.
 *   (c) A `String` COLUMN CONSTRAINED TO A SMALL SET BY A CHECK CONSTRAINT —
 *       the column appears as `` `col` IN (...) `` inside the DDL for the
 *       model's table in `prisma/migrations/<name>/migration.sql`. That is a
 *       hand-rolled enum and behaves like one.
 *
 * The derived set is model-scoped: `db.approvalTask.updateMany` is checked
 * against `ApprovalTask`'s fields only, which is why a `where` key that merely
 * shares a name with another model's state column does not fire. The Prisma
 * delegate name is mapped back to the model by lower-casing the first
 * character. When the delegate cannot be mapped to a model, the guard falls
 * back to the UNION of every model's state fields (fail-loud, not fail-open).
 *
 * DOCUMENTED BLIND SPOTS of the derivation — things it does NOT catch:
 *   - Boolean state flags (`revoked`, `enabled`, `archived`): the schema gives
 *     no way to tell a state flag from a configuration flag.
 *   - Int/BigInt state, including optimistic-concurrency `version` columns and
 *     numeric status codes.
 *   - State packed inside a JSON/LongText blob, or inside a relation filter
 *     (`where: { source: { status: ... } }` — the guard records the relation
 *     key `source`, not the nested field).
 *   - Non-nullable `DateTime` lifecycle stamps that use a sentinel value.
 *   - `String` columns whose closed set is enforced only in application code,
 *     or whose CHECK lives in a migration this guard cannot attribute to a
 *     table (e.g. a bare `ALTER TABLE` far from its `CREATE TABLE`).
 *   - Models created by `db push` with no migration SQL: rule (c) sees nothing.
 *   - `where` keys that are computed (`[key]: value`) or spread (`...filter`).
 *
 * The derivation also OVER-reports in one known way: rule (a) cannot tell an
 * enum used as an addressing key (part of a compound unique, e.g.
 * `provider: ExternalSyncProvider.OPENCLAW`) from an enum used as a pre-state
 * assertion. That is deliberate — over-reporting lands in the baseline for a
 * human to judge, under-reporting silently ships an unsound CAS.
 *
 * `SUPPLEMENTARY_STATE_PREDICATE_FIELDS` below exists precisely for fields in
 * those blind spots. It is a supplement, never the primary source: the derived
 * set is applied first and the supplement is unioned on top.
 *
 * ---------------------------------------------------------------------------
 * BASELINE
 * ---------------------------------------------------------------------------
 *
 * The baseline records pre-existing sites so this guard blocks NEW occurrences
 * without forcing an out-of-scope refactor of already-merged code. A baselined
 * entry is a known defect awaiting its own slice — never a statement that the
 * site is safe.
 *
 * Each entry identifies a SPECIFIC FINDING, not a file: the fingerprint is a
 * digest of (file, receiver text, delegate, resolved model, sorted state
 * predicate names, result variable name), plus an `occurrence` index that
 * disambiguates two structurally identical sites in one file. Line numbers are
 * deliberately excluded because they churn. Consequences:
 *   - A NEW site in an already-baselined file FAILS.
 *   - A baselined entry that no longer matches any finding FAILS as STALE: the
 *     author must delete the entry in the same change that fixes the site, so
 *     the debt list cannot rot into fiction.
 *
 * Regenerate with: `node --import tsx scripts/check-conditional-update-cas.ts
 * --write-baseline`. Regeneration is an explicit, reviewable act; it never
 * happens as a side effect of running the check.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import ts from "typescript";

const BASELINE_PATH = "scripts/conditional-update-cas-baseline.json";
const SCHEMA_PATH = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";

const SCAN_ROOTS = ["lib", "features", "app", "scripts"] as const;
const SOURCE_FILE = /\.[cm]?tsx?$/u;
const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/u;
const SELF = "scripts/check-conditional-update-cas.ts";

const BASELINE_SCHEMA_VERSION = "2026-07-30.conditional-update-cas-baseline.v2";
const BASELINE_ENTRY_NOTE =
  "Known defect awaiting its own slice; NOT a statement that this site is safe.";

/**
 * Fields the schema derivation structurally cannot see (see the blind-spot
 * list above). This is a SUPPLEMENT unioned on top of the derived set, never a
 * replacement for it. Add here only with a reason; prefer making the schema
 * express the state instead.
 */
const SUPPLEMENTARY_STATE_PREDICATE_FIELDS: readonly string[] = [
  // Unconstrained `String` status columns. Several models declare
  // `status String @default("pending")` with no enum and no CHECK constraint
  // (e.g. `BiReportSignalNotification`), so rules (a) and (c) both see nothing
  // — yet a `where` key literally named `status`/`state` is a pre-state
  // assertion by definition.
  "status",
  "state",
  // String reference column that records "already adopted by X"; there is no
  // CHECK constraint to derive it from, and NULL/non-NULL is the pre-state.
  "adoptedByRef",
  // Optimistic-concurrency counters: Int columns, invisible to rules (a)-(c),
  // and a `version` predicate in a conditional update IS a compare-and-swap.
  "version",
  "expectedVersion",
  "revocationEpoch",
];


const RELATION_COMBINATORS: ReadonlySet<string> = new Set(["AND", "OR", "NOT"]);

export type ConditionalUpdateCasReason =
  | "no-transaction"
  | "client-from-parameter"
  | "ambient-client-inside-transaction"
  | "isolation-not-serializable"
  | "unanalyzable-argument";

export type ConditionalUpdateCasFinding = {
  readonly file: string;
  readonly line: number;
  /** Text of the receiver the delegate hangs off, e.g. `db`, `tx`, `this.db`. */
  readonly client: string;
  /** Prisma delegate property, e.g. `authVerificationCode`. */
  readonly delegate: string;
  /** Model the delegate resolves to, or null when the schema cannot place it. */
  readonly model: string | null;
  readonly statePredicates: readonly string[];
  readonly resultVariable: string;
  /** 0-based index among identically fingerprinted sites in the same file. */
  readonly occurrence: number;
  readonly fingerprint: string;
  /** `${file}#${fingerprint}#${occurrence}` — the baseline match key. */
  readonly key: string;
  readonly reason: ConditionalUpdateCasReason;
  readonly detail: string;
};

export type ConditionalUpdateCasBaselineEntry = {
  readonly file: string;
  readonly fingerprint: string;
  readonly occurrence: number;
  readonly client?: string;
  readonly delegate?: string;
  readonly model?: string | null;
  readonly statePredicates?: readonly string[];
  readonly resultVariable?: string;
  readonly reason?: string;
  readonly note?: string;
};

export type ConditionalUpdateCasReport = {
  readonly findings: readonly ConditionalUpdateCasFinding[];
  readonly newViolations: readonly ConditionalUpdateCasFinding[];
  readonly baselinedFindings: readonly ConditionalUpdateCasFinding[];
  readonly staleBaselineEntries: readonly ConditionalUpdateCasBaselineEntry[];
  readonly ok: boolean;
};

// ---------------------------------------------------------------------------
// Prisma schema derivation
// ---------------------------------------------------------------------------

type PrismaField = {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly isList: boolean;
};

type PrismaModel = {
  readonly name: string;
  readonly table: string;
  readonly fields: readonly PrismaField[];
};

type PrismaSchema = {
  readonly enums: ReadonlySet<string>;
  readonly models: readonly PrismaModel[];
};

const BLOCK_OPEN = /^\s*(model|enum)\s+([A-Za-z_]\w*)\s*\{/u;
const FIELD_LINE = /^\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(\[\])?(\?)?/u;
const MAP_LINE = /^\s*@@map\("([^"]+)"\)/u;

export function parsePrismaSchema(text: string): PrismaSchema {
  const enums = new Set<string>();
  const models: PrismaModel[] = [];
  let kind: "model" | "enum" | null = null;
  let name = "";
  let table = "";
  let fields: PrismaField[] = [];

  const flush = () => {
    if (kind === "model" && name) {
      models.push({ name, table: table || name, fields });
    }
    kind = null;
    name = "";
    table = "";
    fields = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\/\/.*$/u, "");
    if (kind === null) {
      const open = BLOCK_OPEN.exec(line);
      if (open) {
        kind = open[1] === "enum" ? "enum" : "model";
        name = open[2] ?? "";
        if (kind === "enum") enums.add(name);
      }
      continue;
    }
    if (/^\s*\}/u.test(line)) {
      flush();
      continue;
    }
    if (kind !== "model") continue;
    const mapped = MAP_LINE.exec(line);
    if (mapped) {
      table = mapped[1] ?? "";
      continue;
    }
    if (/^\s*@@/u.test(line)) continue;
    const field = FIELD_LINE.exec(line);
    if (!field) continue;
    fields.push({
      name: field[1] ?? "",
      type: field[2] ?? "",
      isList: field[3] === "[]",
      nullable: field[4] === "?",
    });
  }
  flush();
  return { enums, models };
}

/**
 * Columns that a migration constrains to a closed set via `` `col` IN (...) ``
 * inside table DDL. `CREATE TABLE` / `ALTER TABLE` set the current table; every
 * `` `col` IN ( `` seen before the next table statement is attributed to it.
 * In this repo's DDL, `IN (` only ever appears inside CHECK constraints.
 */
export function parseCheckConstrainedColumns(
  sql: string,
): Map<string, Set<string>> {
  const byTable = new Map<string, Set<string>>();
  const tableStatement = /(?:CREATE|ALTER)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`(\w+)`/giu;
  const inConstraint = /`(\w+)`\s*(?:NOT\s+)?IN\s*\(/giu;

  const boundaries: { index: number; table: string }[] = [];
  for (const match of sql.matchAll(tableStatement)) {
    boundaries.push({ index: match.index ?? 0, table: match[1] ?? "" });
  }
  if (boundaries.length === 0) return byTable;

  for (const match of sql.matchAll(inConstraint)) {
    const at = match.index ?? 0;
    let table = "";
    for (const boundary of boundaries) {
      if (boundary.index > at) break;
      table = boundary.table;
    }
    if (!table) continue;
    const column = match[1] ?? "";
    if (!column) continue;
    const set = byTable.get(table) ?? new Set<string>();
    set.add(column);
    byTable.set(table, set);
  }
  return byTable;
}

function readMigrationSql(repoRoot: string): string {
  const root = path.join(repoRoot, MIGRATIONS_DIR);
  if (!existsSync(root)) return "";
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (error) {
    throw new Error(
      `conditional-update-cas: cannot traverse migrations at ${MIGRATIONS_DIR}`,
      { cause: error },
    );
  }
  const chunks: string[] = [];
  for (const entry of entries.sort()) {
    const absolute = path.join(root, entry);
    try {
      if (statSync(absolute).isDirectory()) {
        for (const file of readdirSync(absolute).sort()) {
          if (!file.endsWith(".sql")) continue;
          chunks.push(readFileSync(path.join(absolute, file), "utf8"));
        }
      } else if (entry.endsWith(".sql")) {
        chunks.push(readFileSync(absolute, "utf8"));
      }
    } catch (error) {
      throw new Error(
        `conditional-update-cas: cannot read migration entry ${path.join(
          MIGRATIONS_DIR,
          entry,
        )}`,
        { cause: error },
      );
    }
  }
  return chunks.join("\n");
}

export type StatePredicateIndex = {
  /** Prisma delegate name -> state predicate field names for that model. */
  readonly byDelegate: ReadonlyMap<string, ReadonlySet<string>>;
  /** Union across every model, used when the delegate cannot be resolved. */
  readonly union: ReadonlySet<string>;
  readonly derivedFieldCount: number;
  readonly modelCount: number;
};

export function buildStatePredicateIndex(
  schemaText: string,
  migrationSql: string,
): StatePredicateIndex {
  const schema = parsePrismaSchema(schemaText);
  const checkColumns = parseCheckConstrainedColumns(migrationSql);
  const byDelegate = new Map<string, Set<string>>();
  const union = new Set<string>(SUPPLEMENTARY_STATE_PREDICATE_FIELDS);
  let derivedFieldCount = 0;

  for (const model of schema.models) {
    const constrained = checkColumns.get(model.table) ?? new Set<string>();
    const state = new Set<string>(SUPPLEMENTARY_STATE_PREDICATE_FIELDS);
    for (const field of model.fields) {
      const isEnumField = !field.isList && schema.enums.has(field.type);
      const isLifecycleStamp =
        field.type === "DateTime" &&
        field.nullable &&
        !field.isList &&
        field.name.endsWith("At");
      const isConstrainedString =
        field.type === "String" && !field.isList && constrained.has(field.name);
      if (!isEnumField && !isLifecycleStamp && !isConstrainedString) continue;
      state.add(field.name);
      union.add(field.name);
      derivedFieldCount += 1;
    }
    const delegate =
      model.name.charAt(0).toLowerCase() + model.name.slice(1);
    byDelegate.set(delegate, state);
  }

  return {
    byDelegate,
    union,
    derivedFieldCount,
    modelCount: schema.models.length,
  };
}

function loadStatePredicateIndex(repoRoot: string): StatePredicateIndex {
  let schemaText: string;
  try {
    schemaText = readFileSync(path.join(repoRoot, SCHEMA_PATH), "utf8");
  } catch (error) {
    throw new Error(
      `conditional-update-cas: cannot read Prisma schema at ${SCHEMA_PATH}`,
      { cause: error },
    );
  }
  return buildStatePredicateIndex(schemaText, readMigrationSql(repoRoot));
}

// ---------------------------------------------------------------------------
// AST analysis
// ---------------------------------------------------------------------------

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  // `["lifecyclePhase"]` addresses the same column as `lifecyclePhase`, so a
  // computed key with a literal is not an unknown. A computed key built from a
  // VARIABLE is, and returns null so the caller can fail closed on it rather
  // than skip the property and call the object fully understood.
  if (ts.isComputedPropertyName(name)) {
    const expression = unwrapExpression(name.expression);
    return ts.isStringLiteralLike(expression) ? expression.text : null;
  }
  return null;
}

/**
 * Collect the field names a `where` asserts.
 *
 * Returns FALSE when any part of the structure could not be understood — an
 * unresolvable spread, a computed key built from a variable, a value that is
 * not an object literal and does not resolve to one. The caller must treat
 * false as UNKNOWN and report, never as "no state predicates found".
 *
 * That distinction is the whole point. The previous version returned void and
 * simply stopped on anything it did not recognise, after which
 * `whereFields.size === 0` sent the site down the same path as a genuinely safe
 * one. Hoisting the where into a local — an ordinary refactor, and one this
 * codebase already performs on other Prisma calls — therefore erased a finding
 * AND, worse, made the matching baseline entry stale, so the guard itself
 * instructed the author to delete the debt record for a site that was still
 * unsound. Refactoring must not be a way to clear the ledger.
 */
function collectWhereFields(
  source: ts.SourceFile,
  node: ts.Expression,
  out: Set<string>,
  depth = 0,
): boolean {
  if (depth > 8) return false;
  const direct = unwrapExpression(node);
  if (ts.isArrayLiteralExpression(direct)) {
    for (const element of direct.elements) {
      if (!collectWhereFields(source, element, out, depth + 1)) return false;
    }
    return true;
  }
  const literal = resolveObjectLiteral(source, direct);
  if (!literal) return false;
  const flattened = flattenObjectLiteral(source, literal, depth + 1);
  if (!flattened) return false;
  for (const entry of flattened) {
    if (RELATION_COMBINATORS.has(entry.name)) {
      // Combinators wrap sibling predicates; recurse rather than record.
      if (!collectWhereFields(source, entry.value, out, depth + 1)) return false;
      continue;
    }
    // Do NOT recurse into a value: `status: { in: [...] }` is still `status`,
    // and `source: { status: ... }` is a relation filter, not this model's
    // state (recorded as a documented blind spot).
    out.add(entry.name);
  }
  return true;
}

/**
 * The identifier NODE at the root of a receiver expression, so the caller can
 * resolve it to a binding rather than compare its text. `this` has no binding
 * node and yields null.
 */
function rootIdentifierNode(node: ts.Expression): ts.Identifier | null {
  let current: ts.Node = unwrapExpression(node);
  for (;;) {
    if (ts.isIdentifier(current)) return current;
    if (
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current) ||
      ts.isCallExpression(current)
    ) {
      current = unwrapExpression(current.expression);
      continue;
    }
    return null;
  }
}

/**
 * The Prisma DELEGATE a receiver addresses and the CLIENT it hangs off.
 *
 * `db.thing.updateMany(...)` is the easy case. But `const { thing } = db` and
 * `const things = db.thing` and a repository field are all ordinary ways to
 * write the same call, and for each of them the receiver is a bare identifier:
 * `accessedName` returned null and the whole site was DROPPED before any
 * fail-closed branch could see it. Resolving the identifier through its binding
 * recovers the delegate; when it cannot be resolved the caller still reports,
 * with an unknown client and the union state-field index, rather than
 * returning.
 */
type ReceiverResolution = {
  readonly delegate: string | null;
  readonly clientExpression: ts.Expression | null;
};

function resolveReceiver(
  source: ts.SourceFile,
  receiver: ts.Expression,
  depth = 0,
): ReceiverResolution {
  if (depth > 6) return { delegate: null, clientExpression: null };
  const direct = unwrapExpression(receiver);

  if (ts.isPropertyAccessExpression(direct) || ts.isElementAccessExpression(direct)) {
    return {
      delegate: accessedName(direct),
      clientExpression: direct.expression,
    };
  }

  if (ts.isIdentifier(direct)) {
    const binding = resolveBindingNode(direct);
    if (!binding) return { delegate: null, clientExpression: null };

    // `const things = db.thing`
    const initializer = constInitializerOf(binding);
    if (initializer) return resolveReceiver(source, initializer, depth + 1);

    // `const { thing } = db` / `const { thing: t } = db`
    if (ts.isBindingElement(binding)) {
      const property = binding.propertyName ?? binding.name;
      const delegate = ts.isIdentifier(property) ? property.text : null;
      const declaration = binding.parent.parent;
      const clientExpression =
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0
          ? declaration.initializer
          : null;
      return { delegate, clientExpression };
    }
  }

  return { delegate: null, clientExpression: null };
}

function rootIdentifier(node: ts.Expression): string | null {
  let current: ts.Node = node;
  for (;;) {
    if (ts.isIdentifier(current)) return current.text;
    if (current.kind === ts.SyntaxKind.ThisKeyword) return "this";
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    return null;
  }
}

function normaliseText(node: ts.Node): string {
  return node.getText().replace(/\s+/gu, " ").trim();
}

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/**
 * The enclosing lexical scope: the nearest function-like ancestor, or the
 * source file when the call sits at module top level. This replaces the old
 * "scan backwards up to 400 lines" heuristic, which crossed function
 * boundaries in both directions.
 */
function enclosingScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (isFunctionLike(current)) return current;
    current = current.parent;
  }
  return node.getSourceFile();
}

/**
 * True when `name` is bound by a parameter of some enclosing function — i.e.
 * the client is handed in by a caller. The isolation level of such a client is
 * decided outside this file's lexical scope, so the guard cannot prove it and
 * fails closed rather than assuming a serialisable caller.
 */
function isParameterBound(node: ts.Node, name: string): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (isFunctionLike(current)) {
      const parameters = (current as ts.SignatureDeclarationBase).parameters;
      for (const parameter of parameters ?? []) {
        if (ts.isIdentifier(parameter.name)) {
          if (parameter.name.text === name) return true;
          continue;
        }
        let bound = false;
        const visit = (child: ts.Node): void => {
          if (bound) return;
          if (ts.isBindingElement(child) && ts.isIdentifier(child.name)) {
            if (child.name.text === name) bound = true;
            return;
          }
          ts.forEachChild(child, visit);
        };
        visit(parameter.name);
        if (bound) return true;
      }
    }
    current = current.parent;
  }
  return false;
}

/** The module specifier a binding was imported from, or null if it is not an import. */
function importedFromModule(binding: ts.Node): string | null {
  let current: ts.Node | undefined = binding;
  while (current) {
    if (ts.isImportDeclaration(current)) {
      return ts.isStringLiteralLike(current.moduleSpecifier)
        ? current.moduleSpecifier.text
        : null;
    }
    if (ts.isImportEqualsDeclaration(current)) {
      const reference = current.moduleReference;
      return ts.isExternalModuleReference(reference) &&
        ts.isStringLiteralLike(reference.expression)
        ? reference.expression.text
        : null;
    }
    if (ts.isSourceFile(current)) return null;
    current = current.parent;
  }
  return null;
}

/** The modules that can supply the real `TransactionIsolationLevel` enum. */
const PRISMA_CLIENT_MODULES = new Set([
  "@prisma/client",
  "@prisma/client/edge",
  ".prisma/client",
]);

/** Whether an identifier is bound by an import of the generated Prisma client. */
function isPrismaClientImport(node: ts.Expression): boolean {
  if (!ts.isIdentifier(node)) return false;
  const binding = resolveBindingNode(node);
  if (binding === null) return false;
  const specifier = importedFromModule(binding);
  return specifier !== null && PRISMA_CLIENT_MODULES.has(specifier);
}

/**
 * Whether an `isolationLevel` value is PROVABLY Prisma's Serializable.
 *
 * Two things are checked beyond the final name, because certification is what
 * the reader trusts and a guard that can be talked into it is worse than one
 * that misses:
 *
 *   - the QUALIFIER, so `levels.Serializable` — a local constant whose value can
 *     be anything, including "ReadCommitted" — does not certify a transaction;
 *   - where the qualifier COMES FROM, so a local object that merely borrows the
 *     name (`const Prisma = { TransactionIsolationLevel: { Serializable:
 *     "ReadCommitted" } }`) does not certify one either. The root must be bound
 *     by an import of the generated Prisma client; an identifier this file
 *     cannot see a binding for is not proof of anything.
 *
 * The bare string `"Serializable"` is accepted because Prisma itself accepts it:
 * it is the enum's value, not a name that could denote something else.
 */
function isSerializableIsolationExpression(node: ts.Expression): boolean {
  const expression = unwrapExpression(node);
  if (ts.isStringLiteralLike(expression)) return expression.text === "Serializable";
  if (!ts.isPropertyAccessExpression(expression)) return false;
  if (expression.name.text !== "Serializable") return false;
  const qualifier = unwrapExpression(expression.expression);
  // `TransactionIsolationLevel.Serializable` — the enum imported directly.
  if (ts.isIdentifier(qualifier)) {
    return qualifier.text === "TransactionIsolationLevel" && isPrismaClientImport(qualifier);
  }
  // `Prisma.TransactionIsolationLevel.Serializable` — through the namespace.
  if (ts.isPropertyAccessExpression(qualifier)) {
    return (
      qualifier.name.text === "TransactionIsolationLevel" &&
      isPrismaClientImport(unwrapExpression(qualifier.expression))
    );
  }
  return false;
}

/**
 * Resolve an expression to the object literal it denotes, following a
 * `const X = { ... }` binding declared in the same file.
 *
 * This serves BOTH the `$transaction` options argument and the `updateMany`
 * argument. It was originally written for the former only, and the
 * compare-and-swap scan required an inline literal instead of calling it —
 * so hoisting a mutation into a local, which is an ordinary refactor, made a
 * real site invisible to the guard while the capability to see it already
 * existed a few hundred lines up.
 */
/**
 * Nodes that introduce a lexical scope for `const` bindings.
 *
 * A CLASS EXPRESSION is listed because a NAMED one binds its own name inside
 * itself; without it here that binding has no scope to be owned by, and the
 * outward walk sails past it into an outer declaration of the same name.
 */
function isScopeBoundary(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    ts.isClassExpression(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    isDeclarationScope(node) ||
    isFunctionLike(node)
  );
}

/**
 * Declarations that both BIND a name in the enclosing scope and OPEN a scope of
 * their own. They are listed in `isScopeBoundary` so the collector stops at the
 * declaration node instead of descending into its body: `namespace A.B {}`
 * binds `A` in the enclosing scope and `B` only inside `A`, and a walk that
 * descends would attribute `B` to the file.
 */
function isDeclarationScope(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  );
}

/**
 * Whether `node` is a declaration binding the VALUE name `name` in the scope
 * that encloses it.
 *
 * Every form here introduces a name that shadows an outer one, so the scope
 * walk must stop at it. Registering only `function`/`class` let an `enum`,
 * a `const enum` (the same node kind), a `namespace`/`module` block or an
 * `import X = ...` pass unseen, and the walk then resolved the shadowed
 * reference to an OUTER declaration's literal — reading a safe `{ where }` or
 * a `Serializable` options object that the code at hand does not use.
 *
 * TYPE-only declarations (`interface`, `type`) are deliberately absent: they do
 * not occupy the value space, so registering them would shadow a real `const`
 * that legitimately coexists with them and report a site the guard can in fact
 * read.
 */
function declaresValueName(node: ts.Node, name: string): boolean {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    return node.name?.text === name;
  }
  if (ts.isImportEqualsDeclaration(node)) {
    return node.name.text === name;
  }
  if (ts.isModuleDeclaration(node)) {
    // `declare module "pkg"` and `declare global` augment an outer scope rather
    // than binding a local name; only the identifier form binds one.
    if ((node.flags & ts.NodeFlags.GlobalAugmentation) !== 0) return false;
    return ts.isIdentifier(node.name) && node.name.text === name;
  }
  return false;
}

/**
 * Every binding named `name` introduced by `scope` ITSELF, whatever its form.
 *
 * A scope is not made only of `const` declarations. A parameter, a catch
 * binding, a destructured element, an import, a function or class declaration
 * all introduce the same name, and a lookup that recognises only
 * `VariableDeclaration` walks straight past them into an outer scope that
 * happens to declare something safe. That is the same borrowing bug as reading
 * the first match in the file, just one level subtler: the guard would resolve
 * a caller-supplied parameter to an outer literal and certify it.
 *
 * Nested scopes are not descended into: a binding declared inside a nested
 * block is not visible to the code that encloses it. Three forms are the
 * exception, because the binding they introduce belongs to `scope` even though
 * the node carrying it is a scope of its own:
 *   - a function's PARAMETERS, collected when `scope` IS that function;
 *   - a function/class DECLARATION, whose name is bound in the scope that
 *     encloses it. Its body must not be descended into, but the name has to be
 *     recorded BEFORE refusing to descend — a boundary check performed first
 *     makes the registration unreachable, and a block-scoped
 *     `function mutation() {}` shadowing an outer `const mutation` then goes
 *     unseen;
 *   - a NAMED function/class EXPRESSION's own name, which is bound inside its
 *     own scope (that is what lets such a function refer to itself), so it
 *     shadows a same-named outer binding for every reference in its body.
 *
 * An ENUM, a `const enum`, a NAMESPACE/MODULE and an `import X = ...` bind a
 * value name exactly as a `const` does, and are registered here for the same
 * reason: the walk must stop at the first scope that binds the name whatever
 * the form of the binding, or it borrows an outer scope's literal to answer a
 * question about an inner name it cannot actually read. The residual
 * over-report — a non-instantiated (types-only) namespace merged onto a
 * same-named value — costs a finding the reader can dismiss, which is the
 * direction this file errs in by design.
 */
function bindingsOwnedBy(scope: ts.Node, name: string): ts.Node[] {
  const bindings: ts.Node[] = [];

  const collectBindingName = (binding: ts.BindingName, owner: ts.Node): void => {
    if (ts.isIdentifier(binding)) {
      if (binding.text === name) bindings.push(owner);
      return;
    }
    for (const element of binding.elements) {
      if (ts.isBindingElement(element)) collectBindingName(element.name, element);
    }
  };

  if (isFunctionLike(scope)) {
    for (const parameter of scope.parameters) {
      collectBindingName(parameter.name, parameter);
    }
  }

  // A named function or class EXPRESSION binds its own name inside itself.
  if (
    (ts.isFunctionExpression(scope) || ts.isClassExpression(scope)) &&
    scope.name?.text === name
  ) {
    bindings.push(scope);
  }

  const visit = (current: ts.Node): void => {
    // Declarations first: the name they introduce belongs to THIS scope even
    // though the declaration is itself a scope boundary.
    if (declaresValueName(current, name)) {
      bindings.push(current);
      return;
    }
    if (isScopeBoundary(current)) return;
    if (ts.isVariableDeclaration(current)) {
      collectBindingName(current.name, current);
    } else if (
      ts.isImportSpecifier(current) ||
      ts.isImportClause(current) ||
      ts.isNamespaceImport(current)
    ) {
      const bound = current.name;
      if (bound && ts.isIdentifier(bound) && bound.text === name) {
        bindings.push(current);
      }
    } else if (
      ts.isCatchClause(current) &&
      current.variableDeclaration &&
      ts.isIdentifier(current.variableDeclaration.name) &&
      current.variableDeclaration.name.text === name
    ) {
      bindings.push(current.variableDeclaration);
    }
    ts.forEachChild(current, visit);
  };
  ts.forEachChild(scope, visit);
  return bindings;
}

/**
 * The single binding an identifier resolves to, or null when that cannot be
 * decided. Shared by every question the guard asks about a name — which
 * literal an argument denotes, which client a receiver runs on, whether a `tx`
 * inside a `$transaction` callback IS that callback's `tx` — so all of them
 * stop at the same scope for the same reasons.
 *
 * Returning the binding NODE rather than its name is what makes the transaction
 * client check sound: two different bindings may share a name, and a name
 * comparison cannot tell them apart.
 */
function resolveBindingNode(reference: ts.Identifier): ts.Node | null {
  // Walk OUTWARD from the reference through enclosing scopes and stop at the
  // nearest one that declares the name. Walking the whole file from its root
  // and taking the first declaration met is not a scope lookup at all: two
  // functions each declaring `const mutation` would resolve to whichever
  // appeared earlier in the file. That is worse than a miss — the guard would
  // report PASS on a real compare-and-swap by reading a DIFFERENT function's
  // literal, and could equally borrow one function's `Serializable` options to
  // vouch for another's ReadCommitted transaction.
  let scope: ts.Node | undefined = reference.parent;
  while (scope) {
    if (isScopeBoundary(scope)) {
      const bindings = bindingsOwnedBy(scope, reference.text);
      // The FIRST scope that binds this name is the one that wins. Whatever it
      // binds — parameter, destructured element, import, reassignable
      // `let` — the walk STOPS here. Continuing past a binding is how an outer
      // scope's safe literal gets borrowed to vouch for an inner reference the
      // guard cannot actually see.
      if (bindings.length > 0) {
        return bindings.length === 1 ? bindings[0]! : null;
      }
    }
    scope = scope.parent;
  }
  return null;
}

/** The initializer of a `const x = <expr>` binding, or null for any other form. */
function constInitializerOf(binding: ts.Node): ts.Expression | null {
  // Only a `const` bound directly to an expression is analysable. Everything
  // else — a parameter chosen by a caller, a `let` that can be rebound, an
  // import, a catch binding — makes the value a runtime question this guard
  // must not answer.
  if (!ts.isVariableDeclaration(binding)) return null;
  const list = binding.parent;
  if (
    !ts.isVariableDeclarationList(list) ||
    (list.flags & ts.NodeFlags.Const) === 0 ||
    !binding.initializer ||
    !ts.isIdentifier(binding.name)
  ) {
    return null;
  }
  return binding.initializer;
}

type ObjectEntry = { readonly name: string; readonly value: ts.Expression };

/**
 * An object literal's properties in source order, with spreads expanded.
 *
 * Returns null — meaning UNKNOWN, never "no properties" — when a spread cannot
 * be resolved to a literal or a computed key cannot be evaluated. A caller that
 * treats null as an empty object turns "the guard could not read this" into
 * "the guard read this and found nothing", which is the failure mode this whole
 * file exists to prevent.
 *
 * Order is preserved and duplicates are kept, so a caller that must match
 * runtime semantics can take the LAST entry for a name: `{ isolationLevel: A,
 * ...opts }` and `{ isolationLevel: A, isolationLevel: B }` both end with a
 * value the first-match reader would have missed.
 */
function flattenObjectLiteral(
  source: ts.SourceFile,
  literal: ts.ObjectLiteralExpression,
  depth = 0,
): ObjectEntry[] | null {
  if (depth > 8) return null;
  const entries: ObjectEntry[] = [];
  for (const property of literal.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      // `{ where }` — the property value IS this identifier, and it resolves
      // by the ordinary scope rules like any other reference.
      entries.push({ name: property.name.text, value: property.name });
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      const name = propertyName(property.name);
      if (name === null) return null;
      entries.push({ name, value: property.initializer });
      continue;
    }
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveObjectLiteral(source, property.expression);
      if (!spread) return null;
      const nested = flattenObjectLiteral(source, spread, depth + 1);
      if (!nested) return null;
      entries.push(...nested);
      continue;
    }
    // A method, getter or setter in a Prisma argument is not a shape this
    // guard understands; refuse rather than ignore it.
    return null;
  }
  return entries;
}

/** The LAST value bound to `name`, matching runtime override semantics. */
function lastEntry(entries: readonly ObjectEntry[], name: string): ts.Expression | null {
  let found: ts.Expression | null = null;
  for (const entry of entries) {
    if (entry.name === name) found = entry.value;
  }
  return found;
}

function resolveObjectLiteral(
  _source: ts.SourceFile,
  node: ts.Expression,
): ts.ObjectLiteralExpression | null {
  const direct = unwrapExpression(node);
  if (ts.isObjectLiteralExpression(direct)) return direct;
  if (!ts.isIdentifier(direct)) return null;
  const binding = resolveBindingNode(direct);
  if (!binding) return null;
  const initializer = constInitializerOf(binding);
  if (!initializer) return null;
  const unwrapped = unwrapExpression(initializer);
  return ts.isObjectLiteralExpression(unwrapped) ? unwrapped : null;
}

/**
 * Whether the `$transaction` options PROVE a serialisable isolation level.
 *
 * Two ways this used to certify code it had not read. It returned at the FIRST
 * `isolationLevel` property, so `{ isolationLevel: Serializable, ...overrides }`
 * and a literal duplicate key both certified a value the runtime would replace
 * with the later one. And an options object it could not flatten was treated as
 * "no isolationLevel found" rather than "unknown". Both are resolved by reading
 * the flattened entries and taking the LAST — the value the runtime takes —
 * with an unflattenable object returning false (unproven).
 */
function transactionIsSerializable(
  source: ts.SourceFile,
  call: ts.CallExpression,
): boolean {
  const options = call.arguments[1];
  if (!options) return false;
  const literal = resolveObjectLiteral(source, options);
  if (!literal) return false;
  const entries = flattenObjectLiteral(source, literal);
  if (!entries) return false;
  const isolation = lastEntry(entries, "isolationLevel");
  if (!isolation) return false;
  return isSerializableIsolationExpression(isolation);
}

type TransactionContext = {
  readonly call: ts.CallExpression;
  /**
   * The callback's client PARAMETER NODE (`tx`), or null when the callback has
   * no client parameter. A node, not a name: `tx` inside the callback may be a
   * completely different binding that merely shares the name (an inner arrow's
   * own parameter, a `for (const tx of shards)`, a `catch (tx)`), and a name
   * comparison certifies all of them.
   */
  readonly clientParameter: ts.ParameterDeclaration | null;
  /**
   * The array form `$transaction([...])` runs its operations in one
   * transaction on one connection, so there is no separate client to identify
   * and the only open question is the isolation level.
   */
  readonly arrayForm: boolean;
  readonly serializable: boolean;
};

/**
 * The nearest `$transaction(...)` call whose FIRST argument lexically contains
 * `node`. Being inside the options argument, or after the transaction, does not
 * count.
 */
function enclosingTransaction(
  source: ts.SourceFile,
  node: ts.Node,
): TransactionContext | null {
  let child: ts.Node = node;
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === "$transaction"
    ) {
      const callback = current.arguments[0];
      const inCallback =
        callback !== undefined &&
        (child === callback || child.pos >= callback.pos) &&
        child.end <= (callback?.end ?? -1);
      if (inCallback && callback) {
        let clientParameter: ts.ParameterDeclaration | null = null;
        if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
          const parameter = callback.parameters[0];
          if (parameter && ts.isIdentifier(parameter.name)) {
            clientParameter = parameter;
          }
        }
        return {
          call: current,
          clientParameter,
          arrayForm: ts.isArrayLiteralExpression(unwrapExpression(callback)),
          serializable: transactionIsSerializable(source, current),
        };
      }
    }
    child = current;
    current = current.parent;
  }
  return null;
}

/**
 * How the caller consumes the write's result.
 *
 *   "named"  — bound to a name (`const claimed = await ...`, `{ count }`,
 *              `claimed = await ...`, an array-destructured `$transaction`
 *              element); the count read is then searched for by that name.
 *   "inline" — `.count` is taken directly off the call, so the read IS the
 *              consumption and no name exists.
 *   null     — the result is discarded entirely.
 *
 * Every wrapper that does not change the value is unwrapped first. The old
 * version looked at exactly one parent (after an `await`) and required a
 * VariableDeclaration, so one extra pair of parentheses, an assignment to an
 * already-declared variable, or the extremely common
 * `x = (await client.thing.updateMany({...})).count` all made the site
 * invisible. THIRTEEN live sites in this repository are already written in
 * that last form; they escape today only because their `where` addresses rows
 * by key, so adding one state column to any of them would have been silent.
 */
type ResultConsumption =
  | { readonly kind: "named"; readonly name: string; readonly destructured: boolean }
  | { readonly kind: "inline" };

function unwrapValuePreservingParents(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (
    current &&
    (ts.isAwaitExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.parent;
  }
  return current;
}

function bindingFromName(name: ts.BindingName): ResultConsumption | null {
  if (ts.isIdentifier(name)) {
    return { kind: "named", name: name.text, destructured: false };
  }
  if (ts.isObjectBindingPattern(name)) {
    for (const element of name.elements) {
      const property = element.propertyName ?? element.name;
      const propertyText = ts.isIdentifier(property) ? property.text : null;
      if (propertyText === "count" && ts.isIdentifier(element.name)) {
        return { kind: "named", name: element.name.text, destructured: true };
      }
    }
  }
  return null;
}

function resultConsumption(call: ts.CallExpression): ResultConsumption | null {
  const current = unwrapValuePreservingParents(call);
  if (!current) return null;

  // `(await ...).count` / `(await ...)["count"]` — the read is right here.
  if (
    (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) &&
    accessedName(current) === "count"
  ) {
    return { kind: "inline" };
  }

  if (ts.isVariableDeclaration(current)) {
    return bindingFromName(current.name);
  }

  // A helper that returns the whole BatchPayload delegates the count decision
  // beyond this lexical scan. Treat that as consumed so extract-method cannot
  // erase a finding without fixing the underlying write.
  if (ts.isReturnStatement(current)) {
    return { kind: "inline" };
  }

  // Expression-body helpers return their expression without a ReturnStatement
  // node: `const claim = () => db.thing.updateMany(...)`. The wrapper walk
  // reaches the ArrowFunction only when this call is the complete body.
  if (ts.isArrowFunction(current) && !ts.isBlock(current.body)) {
    return { kind: "inline" };
  }

  // `claimed = await ...` into an already-declared variable.
  if (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isIdentifier(current.left)
  ) {
    return { kind: "named", name: current.left.text, destructured: false };
  }

  // Array-form `db.$transaction([ ..., db.thing.updateMany({...}), ... ])`:
  // the result this call produces is the element at the same index of the
  // array the caller destructures.
  if (ts.isArrayLiteralExpression(current)) {
    const index = current.elements.indexOf(call as ts.Expression);
    const owner = unwrapValuePreservingParents(current);
    if (
      index >= 0 &&
      owner &&
      ts.isCallExpression(owner) &&
      accessedName(owner.expression) === "$transaction"
    ) {
      const bound = unwrapValuePreservingParents(owner);
      if (
        bound &&
        ts.isVariableDeclaration(bound) &&
        ts.isArrayBindingPattern(bound.name)
      ) {
        const element = bound.name.elements[index];
        if (element && ts.isBindingElement(element)) {
          return bindingFromName(element.name);
        }
      }
    }
  }

  return null;
}

/**
 * Whether the result's `count` is READ anywhere in the enclosing lexical scope.
 *
 * The rule is deliberately "any read", not "a comparison against a numeric
 * literal". The narrow rule missed `if (claimed.count)`, the standard batch
 * form `claimed.count !== ids.length`, comparison against a named constant,
 * `switch (claimed.count)`, `claimed["count"]`, `(claimed.count) !== 1`, and
 * `const { count } = claimed` — while `if (!claimed.count)`, the same decision
 * written the other way round, was caught. A guard whose coverage depends on
 * which side of an operator a developer put a literal is not a guard.
 *
 * This file's own doctrine settles the trade: over-reporting lands in the
 * baseline for a human to judge, under-reporting silently ships an unsound
 * compare-and-swap. One alias hop is followed (`const outcome = claimed`),
 * because renaming a local is not a semantic change.
 */
function readsCountAsDecision(
  scope: ts.Node,
  variable: string,
  destructured: boolean,
): boolean {
  // Names that denote the same result value: the binding plus one hop of
  // `const alias = <name>`.
  const names = new Set<string>([variable]);
  const collectAliases = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isIdentifier(initializer) && names.has(initializer.text)) {
        names.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(scope);

  let found = false;
  const isTrackedName = (node: ts.Expression): boolean =>
    ts.isIdentifier(unwrapExpression(node)) &&
    names.has((unwrapExpression(node) as ts.Identifier).text);

  const visit = (node: ts.Node): void => {
    if (found) return;
    if (destructured) {
      // `const { count } = await ...` — every reference to the bound name IS a
      // read of the count. The declaration's own name node is not a reference.
      if (
        ts.isIdentifier(node) &&
        node.text === variable &&
        !(ts.isBindingElement(node.parent) && node.parent.name === node) &&
        !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)
      ) {
        found = true;
        return;
      }
    } else {
      if (
        (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        accessedName(node) === "count" &&
        isTrackedName(node.expression)
      ) {
        found = true;
        return;
      }
      // `const { count } = claimed` is a read of the count too.
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer !== undefined &&
        isTrackedName(node.initializer) &&
        node.name.elements.some((element) => {
          const property = element.propertyName ?? element.name;
          return ts.isIdentifier(property) && property.text === "count";
        })
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

/**
 * Length-prefixing each part makes the joined string injective, so no choice of
 * separator can let two different tuples collide.
 */
function fingerprintOf(parts: readonly string[]): string {
  const encoded = parts.map((part) => `${part.length}:${part}`).join("|");
  return createHash("sha256").update(encoded).digest("hex").slice(0, 16);
}

function describe(
  reason: ConditionalUpdateCasReason,
  variable: string,
  statePredicates: readonly string[],
): string {
  const head =
    `\`${variable}.count\` is read as a compare-and-swap result, but the where ` +
    `carries the pre-state (${statePredicates.join(", ")})`;
  const tail =
    "On MySQL the predicate is evaluated at read time and dropped from the " +
    "write, so the count cannot prove the state was unchanged.";
  switch (reason) {
    case "no-transaction":
      return `${head} and the call is not inside a transaction. ${tail}`;
    case "client-from-parameter":
      return (
        `${head} and the client it runs on is handed in as a parameter, so no ` +
        `serialisable transaction can be proven at this site — whether the row ` +
        `is held depends on callers outside this lexical scope. ${tail}`
      );
    case "ambient-client-inside-transaction":
      return (
        `${head} and, although the call is lexically inside a \`$transaction\` ` +
        `callback, it is issued on the AMBIENT client rather than the ` +
        `transaction client, so it runs on its own connection outside the ` +
        `transaction. ${tail}`
      );
    case "unanalyzable-argument":
      return (
        `\`${variable}.count\` is read as a compare-and-swap result, but the ` +
        `call argument could not be resolved to an object literal, so this ` +
        `check cannot see whether the where carries the pre-state. Reported ` +
        `rather than skipped: an unverifiable site and a safe one must not ` +
        `look the same. Inline the argument, or make the write atomic. ${tail}`
      );
    case "isolation-not-serializable":
      return (
        `${head} and the enclosing \`$transaction\` does not declare ` +
        `\`isolationLevel: ...Serializable\`, so the row is not held across ` +
        `the read/write split. ${tail}`
      );
  }
}

function scriptKindFor(file: string): ts.ScriptKind {
  return file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

export /**
 * The property a call or access expression addresses, whether it is written as
 * `x.updateMany` or `x["updateMany"]`. The guard used to accept only the dotted
 * form, so an element access silently became a site the guard never saw — and
 * `["updateMany"]` is ordinary TypeScript, not an evasion trick.
 *
 * A computed key that is not a string literal is genuinely unresolvable here
 * and yields null.
 */
function accessedName(node: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) {
    const key = node.argumentExpression;
    if (key !== undefined && ts.isStringLiteralLike(key)) return key.text;
  }
  return null;
}

/** The receiver of a property or element access. */
function accessTarget(node: ts.Expression): ts.Expression | null {
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return node.expression;
  }
  return null;
}

/** Strip the wrappers that do not change the value an expression denotes. */
function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  for (;;) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

/** Written into a fingerprint wherever the guard could not read the code. */
const UNRESOLVED = "<unresolved>";

function findConditionalUpdateCasSites(
  relativeFile: string,
  content: string,
  index: StatePredicateIndex,
): ConditionalUpdateCasFinding[] {
  const source = ts.createSourceFile(
    relativeFile,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(relativeFile),
  );
  const parseDiagnostics = (
    source as ts.SourceFile & {
      readonly parseDiagnostics?: readonly ts.Diagnostic[];
    }
  ).parseDiagnostics;
  if (parseDiagnostics && parseDiagnostics.length > 0) {
    throw new Error(
      `conditional-update-cas: cannot analyze TypeScript with parse errors in ${relativeFile}`,
    );
  }
  const raw: Omit<ConditionalUpdateCasFinding, "occurrence" | "key">[] = [];

  // FAIL-CLOSED IS A PATTERN HERE, NOT A BRANCH.
  //
  // Every input to the verdict — the argument, the `where`, the receiver, how
  // the count is read, which client the write runs on, the isolation level —
  // can be unreadable. Before this rewrite only the TOP-LEVEL ARGUMENT routed
  // an unknown to a finding; every other input returned early, so "the guard
  // checked this and it is safe" and "the guard never looked" produced the
  // same CI output. `report()` below is the single exit for all of them.
  const visit = (node: ts.Node): void => {
    ts.forEachChild(node, visit);
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    if (accessedName(callee) !== "updateMany") return;
    const receiver = accessTarget(callee);
    if (receiver === null) return;

    const resolvedReceiver = resolveReceiver(source, receiver);
    const delegate = resolvedReceiver.delegate;
    const clientExpression = resolvedReceiver.clientExpression;
    const delegateText = delegate ?? UNRESOLVED;
    const model =
      delegate !== null && index.byDelegate.has(delegate)
        ? delegate.charAt(0).toUpperCase() + delegate.slice(1)
        : null;
    // An unknown delegate cannot be narrowed to one model's columns, so the
    // union of every model's state fields is used — fail loud, not fail open.
    const stateFields =
      delegate !== null
        ? (index.byDelegate.get(delegate) ?? index.union)
        : index.union;
    const clientText =
      clientExpression === null ? UNRESOLVED : normaliseText(clientExpression);
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

    // The count must be consumed as a decision for this to be a
    // compare-and-swap at all; a discarded count is a no-op, not a wrong
    // answer. This is the ONE early return that is not a fail-open, and it is
    // the guard's documented lexical boundary.
    const consumption = resultConsumption(node);
    if (consumption === null) return;
    const resultVariable =
      consumption.kind === "inline" ? "<inline-count>" : consumption.name;
    if (
      consumption.kind === "named" &&
      !readsCountAsDecision(
        enclosingScope(node),
        consumption.name,
        consumption.destructured,
      )
    ) {
      return;
    }

    const report = (
      reason: ConditionalUpdateCasReason,
      statePredicates: readonly string[],
    ): void => {
      const predicates = [...statePredicates];
      raw.push({
        file: relativeFile,
        line,
        client: clientText,
        delegate: delegateText,
        model,
        statePredicates: predicates,
        resultVariable,
        fingerprint: fingerprintOf([
          relativeFile,
          clientText,
          delegateText,
          model ?? UNRESOLVED,
          reason === "unanalyzable-argument"
            ? "<unanalyzable>"
            : predicates.join(","),
          resultVariable,
        ]),
        reason,
        detail: describe(reason, resultVariable, predicates),
      });
    };

    // ---- the argument, and the `where` inside it ----------------------------
    const argument = node.arguments[0];
    const literal =
      argument === undefined ? null : resolveObjectLiteral(source, argument);
    if (literal === null) {
      report("unanalyzable-argument", []);
      return;
    }
    const entries = flattenObjectLiteral(source, literal);
    if (entries === null) {
      report("unanalyzable-argument", []);
      return;
    }
    const whereValue = lastEntry(entries, "where");
    // No `where` at all asserts no pre-state: a blanket update cannot be a
    // compare-and-swap, so this is a real absence rather than an unknown.
    if (whereValue === null) return;

    const whereFields = new Set<string>();
    if (!collectWhereFields(source, whereValue, whereFields)) {
      report("unanalyzable-argument", []);
      return;
    }
    const statePredicates = [...whereFields]
      .filter((field) => stateFields.has(field))
      .sort();
    if (statePredicates.length === 0) return;

    // ---- which client, and is it held by a serialisable transaction? -------
    const transaction = enclosingTransaction(source, node);
    let reason: ConditionalUpdateCasReason | null = null;
    if (!transaction) {
      const clientRoot =
        clientExpression === null ? null : rootIdentifier(clientExpression);
      reason =
        clientRoot !== null && isParameterBound(node, clientRoot)
          ? "client-from-parameter"
          : "no-transaction";
    } else if (transaction.arrayForm) {
      // The array form runs every operation in one transaction on one
      // connection, so client identity is settled by construction and only the
      // isolation level is in question.
      reason = transaction.serializable ? null : "isolation-not-serializable";
    } else if (transaction.clientParameter === null) {
      reason = "ambient-client-inside-transaction";
    } else {
      // NODE IDENTITY, not name equality. `tx` inside the callback may be an
      // inner arrow's own parameter, a `for (const tx of shards)`, a
      // `catch (tx)` or a plain inner `const tx = db` — all of which satisfied
      // a name comparison while the write went somewhere else entirely, and
      // all of which the guard then CERTIFIED as serialisable. An unresolvable
      // client is not the callback's client either.
      const clientRootNode =
        clientExpression === null ? null : rootIdentifierNode(clientExpression);
      const bound = clientRootNode === null ? null : resolveBindingNode(clientRootNode);
      if (bound === null || bound !== transaction.clientParameter) {
        reason = "ambient-client-inside-transaction";
      } else if (!transaction.serializable) {
        reason = "isolation-not-serializable";
      }
    }
    if (reason === null) return;
    report(reason, statePredicates);
  };
  visit(source);

  raw.sort((left, right) => left.line - right.line);
  const seen = new Map<string, number>();
  return raw.map((finding) => {
    const occurrence = seen.get(finding.fingerprint) ?? 0;
    seen.set(finding.fingerprint, occurrence + 1);
    return {
      ...finding,
      occurrence,
      key: `${finding.file}#${finding.fingerprint}#${occurrence}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Repository scan + baseline reconciliation
// ---------------------------------------------------------------------------

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (error) {
    throw new Error(
      `conditional-update-cas: cannot traverse scan root ${root}`,
      { cause: error },
    );
  }
  const files: string[] = [];
  for (const entry of entries.sort()) {
    if (entry === "node_modules" || entry === ".next") continue;
    const absolute = path.join(root, entry);
    if (statSync(absolute).isDirectory()) {
      // Appended one at a time on purpose: `push(...nested)` passes every path
      // as an argument and overflows the call stack once a directory holds tens
      // of thousands of files, which makes the guard CRASH rather than report.
      for (const nested of listFiles(absolute)) files.push(nested);
    } else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) {
      files.push(absolute);
    }
  }
  return files;
}

export function collectConditionalUpdateCasFindings(
  repoRoot: string = process.cwd(),
): ConditionalUpdateCasFinding[] {
  const index = loadStatePredicateIndex(repoRoot);
  const findings: ConditionalUpdateCasFinding[] = [];
  for (const root of SCAN_ROOTS) {
    for (const absolute of listFiles(path.join(repoRoot, root))) {
      const relative = path
        .relative(repoRoot, absolute)
        .split(path.sep)
        .join("/");
      if (relative === SELF) continue;
      const content = readFileSync(absolute, "utf8");
      // Substring prefilter only: requiring the dotted call form here meant a
      // file using `x["updateMany"](...)` was skipped before the parser ever
      // saw it, so the AST fixes above would have been unreachable for it.
      if (!content.includes("updateMany")) continue;
      findings.push(...findConditionalUpdateCasSites(relative, content, index));
    }
  }
  return findings;
}

export function readBaselineEntries(
  repoRoot: string,
): ConditionalUpdateCasBaselineEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path.join(repoRoot, BASELINE_PATH), "utf8"));
  } catch {
    return [];
  }
  const entries =
    typeof parsed === "object" && parsed !== null && "entries" in parsed
      ? (parsed as { entries?: unknown }).entries
      : undefined;
  if (!Array.isArray(entries)) return [];
  const result: ConditionalUpdateCasBaselineEntry[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const file = typeof record.file === "string" ? record.file : "";
    const fingerprint =
      typeof record.fingerprint === "string" ? record.fingerprint : "";
    if (!file || !fingerprint) continue;
    result.push({
      file,
      fingerprint,
      occurrence:
        typeof record.occurrence === "number" ? record.occurrence : 0,
      client: typeof record.client === "string" ? record.client : undefined,
      delegate: typeof record.delegate === "string" ? record.delegate : undefined,
      model: typeof record.model === "string" ? record.model : null,
      statePredicates: Array.isArray(record.statePredicates)
        ? record.statePredicates.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined,
      resultVariable:
        typeof record.resultVariable === "string"
          ? record.resultVariable
          : undefined,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      note: typeof record.note === "string" ? record.note : undefined,
    });
  }
  return result;
}

function baselineKey(entry: ConditionalUpdateCasBaselineEntry): string {
  return `${entry.file}#${entry.fingerprint}#${entry.occurrence}`;
}

export function analyzeConditionalUpdateCas(
  repoRoot: string = process.cwd(),
): ConditionalUpdateCasReport {
  const findings = collectConditionalUpdateCasFindings(repoRoot);
  const baseline = readBaselineEntries(repoRoot);
  const baselineKeys = new Set(baseline.map(baselineKey));
  const findingKeys = new Set(findings.map((finding) => finding.key));

  const newViolations = findings.filter(
    (finding) => !baselineKeys.has(finding.key),
  );
  const baselinedFindings = findings.filter((finding) =>
    baselineKeys.has(finding.key),
  );
  const staleBaselineEntries = baseline.filter(
    (entry) => !findingKeys.has(baselineKey(entry)),
  );

  return {
    findings,
    newViolations,
    baselinedFindings,
    staleBaselineEntries,
    ok: newViolations.length === 0 && staleBaselineEntries.length === 0,
  };
}

/**
 * Back-compatible thin wrapper: the NEW (non-baselined) violations, or every
 * finding when the baseline is ignored. Stale-baseline reporting is only
 * available through `analyzeConditionalUpdateCas`.
 */
export function checkConditionalUpdateCas(
  repoRoot: string = process.cwd(),
  options: { readonly ignoreBaseline?: boolean } = {},
): ConditionalUpdateCasFinding[] {
  const report = analyzeConditionalUpdateCas(repoRoot);
  return options.ignoreBaseline
    ? [...report.findings]
    : [...report.newViolations];
}

export function renderBaseline(
  findings: readonly ConditionalUpdateCasFinding[],
): string {
  return `${JSON.stringify(
    {
      schemaVersion: BASELINE_SCHEMA_VERSION,
      note:
        "Pre-existing sites that read a conditional updateMany count as a " +
        "compare-and-swap while carrying a pre-state predicate without a " +
        "serialisable transaction on the transaction client. On MySQL the " +
        "predicate is dropped from the write, so the count cannot prove the " +
        "state was unchanged. These are NOT fixed; they are recorded so the " +
        "guard can block NEW occurrences without forcing an out-of-scope " +
        "refactor of merged code. Each entry is a known defect awaiting its " +
        "own slice, never a statement that the site is safe.",
      matching:
        "Entries match a SPECIFIC finding, not a file: `fingerprint` digests " +
        "(file, receiver, delegate, model, sorted state predicates, result " +
        "variable) and `occurrence` disambiguates identical sites in one " +
        "file. Line numbers are excluded because they churn. A new site in a " +
        "baselined file FAILS; an entry that matches nothing FAILS as stale " +
        "and must be deleted by whoever fixes the site.",
      provenance:
        "Found while fixing two invariants that CI on mysql:8.4 disproved; " +
        "the mechanism is documented in scripts/check-conditional-update-cas.ts.",
      entries: findings.map((finding) => ({
        file: finding.file,
        fingerprint: finding.fingerprint,
        occurrence: finding.occurrence,
        client: finding.client,
        delegate: finding.delegate,
        model: finding.model,
        statePredicates: finding.statePredicates,
        resultVariable: finding.resultVariable,
        reason: finding.reason,
        note: BASELINE_ENTRY_NOTE,
      })),
    },
    null,
    2,
  )}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.cwd();
  if (process.argv.includes("--write-baseline")) {
    const findings = collectConditionalUpdateCasFindings(repoRoot);
    writeFileSync(
      path.join(repoRoot, BASELINE_PATH),
      renderBaseline(findings),
      "utf8",
    );
    console.log(
      `conditional-update-cas: wrote ${findings.length} entr(ies) to ${BASELINE_PATH}`,
    );
  } else {
    const report = analyzeConditionalUpdateCas(repoRoot);
    if (report.ok) {
      console.log(
        `conditional-update-cas: PASS - no NEW conditional updateMany is read as a compare-and-swap without a serialisable transaction on the transaction client; ${report.baselinedFindings.length} known pre-existing site(s) remain recorded in ${BASELINE_PATH} and are unfixed; this is a concurrency-shape statement, not a proof of production correctness`,
      );
    } else {
      console.error(
        `conditional-update-cas: FAIL - ${report.newViolations.length} new violation(s), ${report.staleBaselineEntries.length} stale baseline entr(ies)`,
      );
      for (const violation of report.newViolations) {
        console.error(
          `- NEW ${violation.file}:${violation.line} [${violation.reason}] ${violation.detail}`,
        );
      }
      for (const entry of report.staleBaselineEntries) {
        console.error(
          `- STALE ${entry.file} fingerprint=${entry.fingerprint} occurrence=${entry.occurrence}: this baselined finding no longer exists (site fixed, moved, or file deleted). Delete the entry from ${BASELINE_PATH} in the same change.`,
        );
      }
      process.exitCode = 1;
    }
  }
}
