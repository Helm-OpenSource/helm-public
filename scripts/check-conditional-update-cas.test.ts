import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeConditionalUpdateCas,
  buildStatePredicateIndex,
  checkConditionalUpdateCas,
  collectConditionalUpdateCasFindings,
  parseCheckConstrainedColumns,
  parsePrismaSchema,
  renderBaseline,
  type ConditionalUpdateCasFinding,
} from "./check-conditional-update-cas";

const roots: string[] = [];

/**
 * A minimal Prisma schema that exercises each derivation rule and its negative:
 *   (a) `lifecyclePhase` is enum-typed          -> state predicate
 *       `label` is a plain String               -> NOT a state predicate
 *   (b) `claimedAt` is a nullable DateTime `*At` -> state predicate
 *       `createdAt` is non-nullable             -> NOT a state predicate
 *       `notes` is nullable but not a DateTime  -> NOT a state predicate
 *   (c) `channel` is a String with a CHECK ... IN -> state predicate
 * None of these names appear in SUPPLEMENTARY_STATE_PREDICATE_FIELDS, so the
 * assertions below prove the DERIVATION is doing the work.
 */
const SCHEMA = `
enum ThingLifecycle {
  PENDING
  CLAIMED
}

model Thing {
  id             String         @id
  lifecyclePhase ThingLifecycle @default(PENDING)
  claimedAt      DateTime?
  createdAt      DateTime
  channel        String
  label          String
  notes          String?
  tags           ThingLifecycle[]
}

model Other {
  id             String @id
  label          String
}
`;

const MIGRATION = `
CREATE TABLE \`Thing\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`channel\` VARCHAR(191) NOT NULL,
  \`label\` VARCHAR(191) NOT NULL,
  CONSTRAINT \`Thing_state_chk\` CHECK (\`channel\` IN ('email', 'sms')),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4;
`;

function sandbox(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "cas-guard-"));
  roots.push(root);
  const all: Record<string, string> = {
    "prisma/schema.prisma": SCHEMA,
    "prisma/migrations/20260101000000_thing/migration.sql": MIGRATION,
    ...files,
  };
  for (const [relative, content] of Object.entries(all)) {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

function writeBaseline(
  root: string,
  findings: readonly ConditionalUpdateCasFinding[],
): void {
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts/conditional-update-cas-baseline.json"),
    renderBaseline(findings),
    "utf8",
  );
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

const CAS_WITH_DERIVED_ENUM = `
export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`;

const ID_ONLY = `
export async function touch() {
  const updated = await db.thing.updateMany({
    where: { id: "x" },
    data: { label: "seen" },
  });
  if (updated.count !== 1) throw new Error("missing");
}
`;

const NON_STATE_FIELDS_ONLY = `
export async function relabel() {
  const updated = await db.thing.updateMany({
    where: { id: "x", label: "old", createdAt: cutoff, notes: null },
    data: { label: "new" },
  });
  if (updated.count !== 1) throw new Error("missing");
}
`;

const SERIALIZABLE_TX = `
export async function claimInTx() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
`;

const SERIALIZABLE_TX_VIA_CONST = `
const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export async function claimInTx() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, TRANSACTION_OPTIONS);
}
`;

const AMBIENT_CLIENT_INSIDE_TX = `
export async function claimInTx() {
  return db.$transaction(async (tx) => {
    await tx.other.findFirst({ where: { id: "x" } });
    const claimed = await db.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
`;

const TX_WITHOUT_ISOLATION = `
export async function claimInTx() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  });
}
`;

const TX_WITH_READ_COMMITTED = `
export async function claimInTx() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
`;

const CLIENT_FROM_PARAMETER = `
export async function claimWith(tx: TransactionClient) {
  const claimed = await tx.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`;

const ATOMIC_RAW = `
export async function claimAtomically() {
  const affected = Number(
    await db.$executeRaw\`
      UPDATE \\\`Thing\\\` SET \\\`lifecyclePhase\\\` = 'CLAIMED'
       WHERE \\\`id\\\` = \${id} AND \\\`lifecyclePhase\\\` = 'PENDING'
    \`,
  );
  if (affected !== 1) throw new Error("lost");
}
`;

const COUNT_NOT_READ = `
export async function sweep() {
  const swept = await db.thing.updateMany({
    where: { lifecyclePhase: "PENDING", claimedAt: null },
    data: { lifecyclePhase: "CLAIMED" },
  });
  return swept.count;
}
`;

const TWO_SITES = `
export async function first() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}

export async function second() {
  const adopted = await db.thing.updateMany({
    where: { id: "y", claimedAt: null },
    data: { claimedAt: new Date() },
  });
  if (adopted.count !== 1) throw new Error("lost");
}
`;

describe("state predicate derivation", () => {
  it("parses models, enums, nullability and @@map from the schema", () => {
    const schema = parsePrismaSchema(SCHEMA);
    expect(schema.enums.has("ThingLifecycle")).toBe(true);
    const thing = schema.models.find((model) => model.name === "Thing");
    expect(thing?.table).toBe("Thing");
    expect(thing?.fields.find((f) => f.name === "claimedAt")).toEqual({
      name: "claimedAt",
      type: "DateTime",
      nullable: true,
      isList: false,
    });
    expect(thing?.fields.find((f) => f.name === "tags")?.isList).toBe(true);
  });

  it("reads CHECK ... IN columns out of migration DDL and attributes them to a table", () => {
    const columns = parseCheckConstrainedColumns(MIGRATION);
    expect([...(columns.get("Thing") ?? [])]).toEqual(["channel"]);
  });

  it("derives enum fields, nullable *At stamps and CHECK-constrained strings, and nothing else", () => {
    const index = buildStatePredicateIndex(SCHEMA, MIGRATION);
    const thing = index.byDelegate.get("thing");
    expect(thing?.has("lifecyclePhase")).toBe(true); // rule (a)
    expect(thing?.has("claimedAt")).toBe(true); // rule (b)
    expect(thing?.has("channel")).toBe(true); // rule (c)
    expect(thing?.has("createdAt")).toBe(false); // (b) needs nullability
    expect(thing?.has("label")).toBe(false); // plain String, no CHECK
    expect(thing?.has("notes")).toBe(false); // nullable but not a DateTime
    expect(thing?.has("tags")).toBe(false); // enum LIST, not a scalar state
  });

  it("scopes the derived set to the model behind the delegate", () => {
    const index = buildStatePredicateIndex(SCHEMA, MIGRATION);
    expect(index.byDelegate.get("other")?.has("lifecyclePhase")).toBe(false);
    expect(index.union.has("lifecyclePhase")).toBe(true);
  });
});

describe("conditional-update compare-and-swap guard", () => {
  it("catches a DERIVED state predicate that is not in the supplementary list", () => {
    // `lifecyclePhase` is invisible to any hardcoded status/state name list;
    // it is only a state predicate because the schema types it as an enum.
    const root = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("lib/claim.ts");
    expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
    expect(violations[0]?.model).toBe("Thing");
    expect(violations[0]?.reason).toBe("no-transaction");
  });

  // A guard that a rename evades is not a guard. These three shapes are all
  // ordinary TypeScript that a developer could write without any intent to
  // avoid the check, and every one of them used to return PASS on a real
  // compare-and-swap site.
  it("catches an updateMany reached through element access", () => {
    const root = sandbox({
      "lib/claim.ts": `
export async function claim() {
  const claimed = await db.thing["updateMany"]({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
    expect(violations[0]?.model).toBe("Thing");
  });

  it("catches an updateMany whose argument is a local const", () => {
    const root = sandbox({
      "lib/claim.ts": `
export async function claim() {
  const mutation = {
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  };
  const claimed = await db.thing.updateMany(mutation);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
  });

  // Fail-closed: when the argument cannot be resolved to an object literal the
  // guard must REPORT rather than skip. Skipping is what turned every
  // unanalyzable shape into a silent PASS.
  it("reports an unanalyzable updateMany argument instead of skipping it", () => {
    const root = sandbox({
      "lib/claim.ts": `
export async function claim(mutation: unknown) {
  const claimed = await db.thing.updateMany(mutation as never);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("unanalyzable-argument");
  });

  it("catches a derived nullable *At lifecycle stamp", () => {
    const root = sandbox({
      "lib/adopt.ts": `
export async function adopt() {
  const adopted = await db.thing.updateMany({
    where: { id: "x", claimedAt: null },
    data: { claimedAt: new Date() },
  });
  if (adopted.count !== 1) throw new Error("lost");
}
`,
    });
    expect(checkConditionalUpdateCas(root)[0]?.statePredicates).toEqual([
      "claimedAt",
    ]);
  });

  it("catches a derived CHECK-constrained String column", () => {
    const root = sandbox({
      "lib/route.ts": `
export async function route() {
  const moved = await db.thing.updateMany({
    where: { id: "x", channel: "email" },
    data: { channel: "sms" },
  });
  if (moved.count !== 1) throw new Error("lost");
}
`,
    });
    expect(checkConditionalUpdateCas(root)[0]?.statePredicates).toEqual([
      "channel",
    ]);
  });

  it("does not flag an update addressed by primary key alone", () => {
    const root = sandbox({ "lib/touch.ts": ID_ONLY });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("does not flag a where built only from non-state columns", () => {
    const root = sandbox({ "lib/relabel.ts": NON_STATE_FIELDS_ONLY });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("does not flag a count that is returned rather than compared", () => {
    const root = sandbox({ "lib/sweep.ts": COUNT_NOT_READ });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("does not flag a tx. call inside a serialisable transaction", () => {
    const root = sandbox({ "lib/tx.ts": SERIALIZABLE_TX });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("resolves an isolation level held in a module-level options constant", () => {
    const root = sandbox({ "lib/tx-const.ts": SERIALIZABLE_TX_VIA_CONST });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("flags an AMBIENT-client call inside a serialisable transaction callback", () => {
    const root = sandbox({ "lib/ambient.ts": AMBIENT_CLIENT_INSIDE_TX });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.client).toBe("db");
    expect(violations[0]?.reason).toBe("ambient-client-inside-transaction");
    expect(violations[0]?.detail).toContain("AMBIENT client");
  });

  it("flags a transaction that carries no isolation level", () => {
    const root = sandbox({ "lib/no-isolation.ts": TX_WITHOUT_ISOLATION });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("isolation-not-serializable");
  });

  it("flags a transaction whose isolation level is weaker than serialisable", () => {
    const root = sandbox({ "lib/read-committed.ts": TX_WITH_READ_COMMITTED });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("isolation-not-serializable");
  });

  it("flags a client handed in as a parameter, whose isolation is not lexically provable", () => {
    const root = sandbox({ "lib/helper.ts": CLIENT_FROM_PARAMETER });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("client-from-parameter");
  });

  it("does not cross a function boundary when looking for the enclosing transaction", () => {
    const root = sandbox({
      "lib/sibling.ts": `
export async function inTx() {
  return db.$transaction(async (tx) => {
    await tx.other.findFirst({ where: { id: "x" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    // The old backwards-text-scan heuristic saw the `$transaction` above and
    // suppressed this site; a lexical walk does not.
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("no-transaction");
  });

  it("does not read a count comparison that belongs to a different function", () => {
    const root = sandbox({
      "lib/split.ts": `
export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  return claimed;
}

export async function elsewhere(claimed: { count: number }) {
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("accepts the atomic raw statement that replaces the pattern", () => {
    const root = sandbox({ "lib/atomic.ts": ATOMIC_RAW });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("does not treat a test file as production code", () => {
    const root = sandbox({ "lib/claim.test.ts": CAS_WITH_DERIVED_ENUM });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });
});

describe("baseline reconciliation", () => {
  it("suppresses a baselined finding but still reports it when the baseline is ignored", () => {
    const root = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    writeBaseline(root, collectConditionalUpdateCasFindings(root));
    expect(checkConditionalUpdateCas(root)).toEqual([]);
    expect(
      checkConditionalUpdateCas(root, { ignoreBaseline: true }),
    ).toHaveLength(1);
    expect(analyzeConditionalUpdateCas(root).ok).toBe(true);
  });

  it("FLAGS A NEW SITE IN AN ALREADY-BASELINED FILE", () => {
    const root = sandbox({ "lib/two.ts": TWO_SITES });
    const findings = collectConditionalUpdateCasFindings(root);
    expect(findings).toHaveLength(2);
    // Baseline only the first site, then assert the second is still reported
    // even though its FILE is baselined.
    writeBaseline(root, [findings[0]!]);
    const report = analyzeConditionalUpdateCas(root);
    expect(report.newViolations).toHaveLength(1);
    expect(report.newViolations[0]?.file).toBe("lib/two.ts");
    expect(report.newViolations[0]?.statePredicates).toEqual(["claimedAt"]);
    expect(report.ok).toBe(false);
  });

  it("distinguishes two structurally identical sites in one file by occurrence", () => {
    const twin = `
export async function first() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}

export async function second() {
  const claimed = await db.thing.updateMany({
    where: { id: "y", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`;
    const root = sandbox({ "lib/twin.ts": twin });
    const findings = collectConditionalUpdateCasFindings(root);
    expect(findings).toHaveLength(2);
    expect(findings[0]?.fingerprint).toBe(findings[1]?.fingerprint);
    expect(findings.map((finding) => finding.occurrence)).toEqual([0, 1]);
    writeBaseline(root, [findings[0]!]);
    expect(analyzeConditionalUpdateCas(root).newViolations).toHaveLength(1);
  });

  it("keeps a fingerprint stable when only line numbers move", () => {
    const before = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    const after = sandbox({
      "lib/claim.ts": `// a new banner comment\n// and another line\n${CAS_WITH_DERIVED_ENUM}`,
    });
    const [first] = collectConditionalUpdateCasFindings(before);
    const [second] = collectConditionalUpdateCasFindings(after);
    expect(first?.line).not.toBe(second?.line);
    expect(first?.fingerprint).toBe(second?.fingerprint);
  });

  it("FAILS ON A STALE BASELINE ENTRY WHEN THE SITE IS FIXED", () => {
    const root = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    const findings = collectConditionalUpdateCasFindings(root);
    writeBaseline(root, findings);
    expect(analyzeConditionalUpdateCas(root).ok).toBe(true);

    // The author fixes the site but forgets to remove the baseline entry.
    writeFileSync(path.join(root, "lib/claim.ts"), ATOMIC_RAW);
    const report = analyzeConditionalUpdateCas(root);
    expect(report.newViolations).toEqual([]);
    expect(report.staleBaselineEntries).toHaveLength(1);
    expect(report.staleBaselineEntries[0]?.file).toBe("lib/claim.ts");
    expect(report.ok).toBe(false);
  });

  it("FAILS ON A STALE BASELINE ENTRY WHEN THE FILE IS DELETED", () => {
    const root = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    writeBaseline(root, collectConditionalUpdateCasFindings(root));
    rmSync(path.join(root, "lib/claim.ts"));
    const report = analyzeConditionalUpdateCas(root);
    expect(report.staleBaselineEntries).toHaveLength(1);
    expect(report.ok).toBe(false);
  });

  it("records each entry as a known defect, never as a safe site", () => {
    const root = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    const rendered = renderBaseline(collectConditionalUpdateCasFindings(root));
    const parsed = JSON.parse(rendered) as {
      note: string;
      entries: { note: string; fingerprint: string; occurrence: number }[];
    };
    expect(parsed.note).toContain("known defect awaiting its own slice");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.note).toContain("NOT a statement");
    expect(parsed.entries[0]?.fingerprint).toMatch(/^[0-9a-f]{16}$/u);
    expect(parsed.entries[0]?.occurrence).toBe(0);
  });
});

describe("the repository's own baseline", () => {
  it("is exactly reconciled: no new violations and no stale entries", () => {
    const report = analyzeConditionalUpdateCas(process.cwd());
    expect(report.newViolations).toEqual([]);
    expect(report.staleBaselineEntries).toEqual([]);
    expect(report.findings.length).toBeGreaterThan(0);
  });
});
