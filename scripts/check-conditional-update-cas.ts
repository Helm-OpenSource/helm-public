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
 *   1. It is `<client>.<delegate>.updateMany({ where: {...}, ... })`, awaited
 *      and bound to a variable (either `const x = await ...` or
 *      `const { count } = await ...`).
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
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

const COMPARISON_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

const RELATION_COMBINATORS: ReadonlySet<string> = new Set(["AND", "OR", "NOT"]);

export type ConditionalUpdateCasReason =
  | "no-transaction"
  | "client-from-parameter"
  | "ambient-client-inside-transaction"
  | "isolation-not-serializable";

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
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return "";
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
    } catch {
      // A migration directory that cannot be read contributes no rule (c)
      // columns; rules (a) and (b) still apply.
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
  let schemaText = "";
  try {
    schemaText = readFileSync(path.join(repoRoot, SCHEMA_PATH), "utf8");
  } catch {
    schemaText = "";
  }
  return buildStatePredicateIndex(schemaText, readMigrationSql(repoRoot));
}

// ---------------------------------------------------------------------------
// AST analysis
// ---------------------------------------------------------------------------

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return null;
}

function collectWhereFields(node: ts.Node, out: Set<string>): void {
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) collectWhereFields(element, out);
    return;
  }
  if (!ts.isObjectLiteralExpression(node)) return;
  for (const property of node.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      out.add(property.name.text);
      continue;
    }
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (!name) continue;
    if (RELATION_COMBINATORS.has(name)) {
      // Combinators wrap sibling predicates; recurse rather than record.
      collectWhereFields(property.initializer, out);
      continue;
    }
    // Do NOT recurse into a value: `status: { in: [...] }` is still `status`,
    // and `source: { status: ... }` is a relation filter, not this model's
    // state (recorded as a documented blind spot).
    out.add(name);
  }
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

function isSerializableIsolationExpression(node: ts.Expression): boolean {
  if (ts.isStringLiteralLike(node)) return node.text === "Serializable";
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "Serializable";
  }
  return false;
}

/** Resolve a module-level `const X = { ... }` used as the options argument. */
function resolveObjectLiteral(
  source: ts.SourceFile,
  node: ts.Expression,
): ts.ObjectLiteralExpression | null {
  if (ts.isObjectLiteralExpression(node)) return node;
  if (!ts.isIdentifier(node)) return null;
  const wanted = node.text;
  let found: ts.ObjectLiteralExpression | null = null;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === wanted &&
      current.initializer
    ) {
      const initializer = ts.isAsExpression(current.initializer)
        ? current.initializer.expression
        : current.initializer;
      if (ts.isObjectLiteralExpression(initializer)) {
        found = initializer;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(source);
  return found;
}

function transactionIsSerializable(
  source: ts.SourceFile,
  call: ts.CallExpression,
): boolean {
  const options = call.arguments[1];
  if (!options) return false;
  const literal = resolveObjectLiteral(source, options);
  if (!literal) return false;
  for (const property of literal.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (propertyName(property.name) !== "isolationLevel") continue;
    return isSerializableIsolationExpression(property.initializer);
  }
  return false;
}

type TransactionContext = {
  readonly call: ts.CallExpression;
  /** The callback's client parameter name (`tx`), or null when unnamed. */
  readonly clientParameter: string | null;
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
        let clientParameter: string | null = null;
        if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
          const parameter = callback.parameters[0];
          if (parameter && ts.isIdentifier(parameter.name)) {
            clientParameter = parameter.name.text;
          }
        }
        return {
          call: current,
          clientParameter,
          serializable: transactionIsSerializable(source, current),
        };
      }
    }
    child = current;
    current = current.parent;
  }
  return null;
}

function resultBinding(call: ts.CallExpression): string | null {
  let current: ts.Node | undefined = call.parent;
  if (current && ts.isAwaitExpression(current)) current = current.parent;
  if (!current) return null;
  if (ts.isVariableDeclaration(current)) {
    if (ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isObjectBindingPattern(current.name)) {
      for (const element of current.name.elements) {
        const property = element.propertyName ?? element.name;
        const propertyText = ts.isIdentifier(property) ? property.text : null;
        if (propertyText === "count" && ts.isIdentifier(element.name)) {
          return element.name.text;
        }
      }
    }
    return null;
  }
  return null;
}

function readsCountAsDecision(
  scope: ts.Node,
  variable: string,
  destructured: boolean,
): boolean {
  let found = false;
  const matchesCount = (node: ts.Expression): boolean => {
    if (destructured) {
      return ts.isIdentifier(node) && node.text === variable;
    }
    return (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "count" &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === variable
    );
  };
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isBinaryExpression(node) && COMPARISON_OPERATORS.has(node.operatorToken.kind)) {
      const left = node.left;
      const right = node.right;
      if (
        (matchesCount(left) && ts.isNumericLiteral(right)) ||
        (matchesCount(right) && ts.isNumericLiteral(left))
      ) {
        found = true;
        return;
      }
    }
    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken &&
      matchesCount(node.operand)
    ) {
      // `if (!claimed.count)` is a comparison against zero.
      found = true;
      return;
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

export function findConditionalUpdateCasSites(
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
  const raw: Omit<ConditionalUpdateCasFinding, "occurrence" | "key">[] = [];

  const visit = (node: ts.Node): void => {
    ts.forEachChild(node, visit);
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee)) return;
    if (callee.name.text !== "updateMany") return;
    const receiver = callee.expression;
    if (!ts.isPropertyAccessExpression(receiver)) return;
    const delegate = receiver.name.text;
    const clientExpression = receiver.expression;

    const argument = node.arguments[0];
    if (!argument || !ts.isObjectLiteralExpression(argument)) return;
    let whereLiteral: ts.Expression | null = null;
    for (const property of argument.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (propertyName(property.name) !== "where") continue;
      whereLiteral = property.initializer;
    }
    if (!whereLiteral) return;

    const whereFields = new Set<string>();
    collectWhereFields(whereLiteral, whereFields);
    if (whereFields.size === 0) return;

    const model =
      index.byDelegate.has(delegate)
        ? delegate.charAt(0).toUpperCase() + delegate.slice(1)
        : null;
    const stateFields = index.byDelegate.get(delegate) ?? index.union;
    const statePredicates = [...whereFields]
      .filter((field) => stateFields.has(field))
      .sort();
    if (statePredicates.length === 0) return;

    const variable = resultBinding(node);
    if (!variable) return;
    const destructured =
      node.parent !== undefined &&
      (() => {
        let current: ts.Node | undefined = node.parent;
        if (current && ts.isAwaitExpression(current)) current = current.parent;
        return (
          current !== undefined &&
          ts.isVariableDeclaration(current) &&
          ts.isObjectBindingPattern(current.name)
        );
      })();

    const scope = enclosingScope(node);
    if (!readsCountAsDecision(scope, variable, destructured)) return;

    const transaction = enclosingTransaction(source, node);
    const clientRoot = rootIdentifier(clientExpression);
    let reason: ConditionalUpdateCasReason | null = null;
    if (!transaction) {
      reason =
        clientRoot !== null && isParameterBound(node, clientRoot)
          ? "client-from-parameter"
          : "no-transaction";
    } else if (
      transaction.clientParameter === null ||
      clientRoot !== transaction.clientParameter
    ) {
      reason = "ambient-client-inside-transaction";
    } else if (!transaction.serializable) {
      reason = "isolation-not-serializable";
    }
    if (reason === null) return;

    const client = normaliseText(clientExpression);
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    raw.push({
      file: relativeFile,
      line,
      client,
      delegate,
      model,
      statePredicates,
      resultVariable: variable,
      fingerprint: fingerprintOf([
        relativeFile,
        client,
        delegate,
        model ?? "<unresolved>",
        statePredicates.join(","),
        variable,
      ]),
      reason,
      detail: describe(reason, variable, statePredicates),
    });
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
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort()) {
    if (entry === "node_modules" || entry === ".next") continue;
    const absolute = path.join(root, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...listFiles(absolute));
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
      if (!content.includes(".updateMany(")) continue;
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
