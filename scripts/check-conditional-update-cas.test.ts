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

// Fixtures that mean to PROVE a serialisable isolation level import `Prisma`
// the way every real site in this repository does. The guard traces the
// qualifier back to that import, so a fixture that leaves the name unbound
// would be testing the unproven path while claiming to test the proven one.
const PRISMA_IMPORT = `import { Prisma } from "@prisma/client";`;

/** The conditional write, issued on whatever `tx` denotes where it is placed. */
const SHADOWED_TX_WRITE = `const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");`;

const SERIALIZABLE_TX = `
${PRISMA_IMPORT}
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
${PRISMA_IMPORT}
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
${PRISMA_IMPORT}
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
${PRISMA_IMPORT}
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

  // DOCTRINE CHANGE, made deliberately. This used to assert that returning the
  // count was NOT a finding, on the grounds that the comparison happens in a
  // caller. That made "return the result to the caller" the cheapest possible
  // way to delete a finding — cheaper than fixing it, and reachable by an IDE
  // extract-method with no thought at all. Any READ of the count is now a
  // decision read: the count leaving the function is the count being used to
  // decide something, somewhere the guard cannot see, which is the definition
  // of unproven.
  it("flags a count that is returned to a caller rather than compared here", () => {
    const root = sandbox({ "lib/sweep.ts": COUNT_NOT_READ });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("no-transaction");
  });

  it("still ignores a call whose result is discarded entirely", () => {
    const root = sandbox({
      "lib/discard.ts": `
export async function sweep() {
  await db.thing.updateMany({
    where: { lifecyclePhase: "PENDING", claimedAt: null },
    data: { lifecyclePhase: "CLAIMED" },
  });
}
`,
    });
    // Nothing reads the count, so a lost update is a no-op rather than a wrong
    // answer. This is the control that keeps the broadened rule from becoming
    // "report every updateMany".
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
${PRISMA_IMPORT}
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

  // Both fixtures below put the SAFE-LOOKING declaration first on purpose: a
  // whole-file walk that takes the first same-named `const` resolves to it and
  // reports PASS, so the guard would vouch for the unsafe site rather than
  // merely miss it.
  it("resolves a mutation argument in the caller's scope, not another function's", () => {
    const root = sandbox({
      "lib/shadowed-mutation.ts": `
export async function relabel() {
  const mutation = {
    where: { id: "x" },
    data: { label: "renamed" },
  };
  await db.thing.updateMany(mutation);
}

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
    expect(violations[0]?.reason).toBe("no-transaction");
  });

  it("does not borrow another function's Serializable transaction options", () => {
    const root = sandbox({
      "lib/shadowed-options.ts": `
${PRISMA_IMPORT}
export async function strictlyIsolated() {
  const options = {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  };
  return db.$transaction(async (tx) => {
    await tx.thing.updateMany({
      where: { id: "x" },
      data: { label: "renamed" },
    });
  }, options);
}

export async function looselyIsolated() {
  const options = {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  };
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, options);
}
`,
    });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.statePredicates).toEqual(["claimedAt"]);
  });

  it("fails closed when a reassigned binding makes the argument unknowable", () => {
    const root = sandbox({
      "lib/reassigned-mutation.ts": `
export async function claim(pending: boolean) {
  let mutation = {
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  };
  if (!pending) {
    mutation = { where: { id: "x" }, data: { label: "renamed" } };
  }
  const claimed = await db.thing.updateMany(mutation);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    // The binding is not a stable `const`, so which literal reaches the call
    // is a runtime question. Reporting is the fail-closed answer: a guard that
    // stayed silent here would be silent on the branch that IS a CAS.
    expect(checkConditionalUpdateCas(root)).toHaveLength(1);
  });

  // A scope is not made only of `const` declarations. A parameter, a catch
  // binding or a destructured element introduces the SAME name, and a walk
  // that only recognises variable declarations walks straight past them into
  // an outer scope that happens to declare something safe.
  it("stops at a parameter that shadows an outer const of the same name", () => {
    const root = sandbox({
      "lib/param-shadow.ts": `
const mutation = {
  where: { id: "x" },
  data: { label: "renamed" },
};

export async function relabel() {
  await db.thing.updateMany(mutation);
}

export async function claim(mutation: { where: unknown; data: unknown }) {
  const claimed = await db.thing.updateMany(mutation);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
    });
    // The argument is a parameter, so its contents are decided by a caller and
    // cannot be read here. Fail closed.
    expect(checkConditionalUpdateCas(root)).toHaveLength(1);
  });

  it("stops at a parameter that shadows an outer const transaction options", () => {
    const root = sandbox({
      "lib/param-shadow-options.ts": `
${PRISMA_IMPORT}
const options = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};

export async function strictlyIsolated() {
  return db.$transaction(async (tx) => {
    await tx.thing.updateMany({
      where: { id: "x" },
      data: { label: "renamed" },
    });
  }, options);
}

export async function callerChosen(options: { isolationLevel: string }) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, options);
}
`,
    });
    // The isolation level is chosen by a caller, so it cannot be proven here.
    expect(checkConditionalUpdateCas(root)).toHaveLength(1);
  });

  // A function declaration binds its name in the scope that ENCLOSES it, and in
  // a block it is that block's binding. The scope walk therefore has to record
  // it before refusing to descend into the function's own body — a boundary
  // check performed first makes the registration unreachable and the shadowing
  // invisible, so the outer `const` gets borrowed to vouch for a reference that
  // does not resolve to it at all.
  it("stops at a block-scoped function declaration that shadows an outer const", () => {
    const root = sandbox({
      "lib/function-declaration-shadow.ts": `
const mutation = {
  where: { id: "x" },
  data: { label: "renamed" },
};

export async function relabel() {
  await db.thing.updateMany(mutation);
}

export async function claim(pending: boolean) {
  if (pending) {
    function mutation(this: void) {
      return { where: { id: "x", lifecyclePhase: "PENDING" }, data: {} };
    }
    const claimed = await db.thing.updateMany(mutation);
    if (claimed.count !== 1) throw new Error("lost");
  }
}
`,
    });
    // The argument names the block's function declaration, not the outer
    // literal. It cannot be read as an object literal here, so the site is
    // unverifiable and must be reported rather than certified by a binding the
    // reference never reaches.
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("unanalyzable-argument");
  });

  // A NAMED function expression binds its own name inside its own scope. The
  // name is therefore shadowed for every reference in that body, including one
  // that would otherwise resolve to a same-named outer `const`.
  it("stops at a named function expression's own name binding", () => {
    const root = sandbox({
      "lib/named-function-expression-shadow.ts": `
${PRISMA_IMPORT}
const options = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};

export async function strictlyIsolated() {
  return db.$transaction(async (tx) => {
    await tx.thing.updateMany({
      where: { id: "x" },
      data: { label: "renamed" },
    });
  }, options);
}

export const callerChosen = function options(this: void) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, options);
};
`,
    });
    // Inside the named function expression `options` is the function itself,
    // not the outer transaction options, so no Serializable isolation can be
    // proven at this site.
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("isolation-not-serializable");
  });

  // Same rule, the class form: a named class expression binds its own name
  // inside itself, which also makes it a scope the outward walk has to stop at.
  it("stops at a named class expression's own name binding", () => {
    const root = sandbox({
      "lib/named-class-expression-shadow.ts": `
const mutation = {
  where: { id: "x" },
  data: { label: "renamed" },
};

export async function relabel() {
  await db.thing.updateMany(mutation);
}

export const Claimer = class mutation {
  async claim() {
    const claimed = await db.thing.updateMany(mutation);
    if (claimed.count !== 1) throw new Error("lost");
  }
};
`,
    });
    // Inside the class body `mutation` is the class itself, not the outer
    // literal, so the argument cannot be read here.
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("unanalyzable-argument");
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

// ---------------------------------------------------------------------------
// FAIL-CLOSED ON EVERY JUDGEMENT INPUT
//
// The guard reads six things to reach a verdict: the argument, the `where`
// inside it, how the result is bound, how the count is read, which client the
// write runs on, and the isolation level. Each of these used to SKIP the site
// when it could not be understood, so "checked and safe" and "never looked"
// produced identical CI output — while only the first of the six failed closed.
//
// Every fixture below was silent before that was fixed. The CONTROL is first
// and MUST report: a fixture harness that has quietly broken (a schema the
// parser could not read, a file the scanner never visited) reports zero for
// everything, which is indistinguishable from a guard that has been fixed.
// ---------------------------------------------------------------------------
describe("conditional-update compare-and-swap guard: unreadable inputs are reported", () => {
  const CONTROL = `
export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`;

  it("CONTROL: the inline form still reports (a zero here means the harness broke)", () => {
    const violations = checkConditionalUpdateCas(sandbox({ "lib/control.ts": CONTROL }));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("no-transaction");
    expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
  });

  // --- the `where` -------------------------------------------------------
  it("resolves a `where` hoisted into a local and passed by shorthand", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/where-shorthand.ts": `
export async function claim() {
  const where = { id: "x", lifecyclePhase: "PENDING" };
  const claimed = await db.thing.updateMany({ where, data: { lifecyclePhase: "CLAIMED" } });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
      }),
    );
    // Hoisting the where is an ordinary refactor. It must not change the
    // verdict — and, because the fingerprint is unchanged, it must not turn a
    // baselined entry stale either, which is how a refactor used to get the
    // guard's own endorsement for deleting a live debt record.
    expect(violations).toHaveLength(1);
    expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
  });

  it("resolves a computed key written as a string literal", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/computed-literal-key.ts": `
export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", ["lifecyclePhase"]: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
  });

  it("reports a `where` whose key is a variable it cannot evaluate", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/computed-variable-key.ts": `
export async function claim(key: string) {
  const claimed = await db.thing.updateMany({
    where: { id: "x", [key]: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("unanalyzable-argument");
  });

  it("reports a `where` carrying a spread it cannot resolve", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/where-spread.ts": `
export async function claim(extra: Record<string, unknown>) {
  const claimed = await db.thing.updateMany({
    where: { id: "x", ...extra },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("unanalyzable-argument");
  });

  // --- how the result is bound -------------------------------------------
  it("sees `.count` taken directly off the awaited call", () => {
    // THIRTEEN live sites in this repository are already written this way.
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/inline-count.ts": `
export async function claim() {
  if ((await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  })).count !== 1) {
    throw new Error("lost");
  }
}
`,
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.resultVariable).toBe("<inline-count>");
  });

  it("sees a result assigned to an already-declared variable", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/late-assignment.ts": `
export async function claim() {
  let claimed;
  claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
      }),
    );
    expect(violations).toHaveLength(1);
  });

  it("sees an array-form $transaction element destructured by position", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/array-transaction.ts": `
export async function claim() {
  const [claimed] = await db.$transaction([
    db.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    }),
  ]);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
      }),
    );
    // The array form really is one transaction on one connection, so the only
    // open question is the isolation level — and it is not declared here.
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toBe("isolation-not-serializable");
  });

  // --- how the count is read ---------------------------------------------
  it("treats bare truthiness, element access and an alias hop as count reads", () => {
    const cases: [string, string][] = [
      ["truthy", "if (claimed.count) return;"],
      ["element-access", 'if (claimed["count"] !== 1) throw new Error("lost");'],
      ["parenthesised", 'if ((claimed.count) !== 1) throw new Error("lost");'],
      ["named-constant", "if (claimed.count !== EXPECTED) throw new Error('lost');"],
      ["switch", "switch (claimed.count) { case 1: break; default: throw new Error('lost'); }"],
      ["alias", "const outcome = claimed; if (outcome.count !== 1) throw new Error('lost');"],
      ["late-destructure", "const { count } = claimed; if (count !== 1) throw new Error('lost');"],
    ];
    for (const [id, tail] of cases) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/read-${id}.ts`]: `
const EXPECTED = 1;
export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  ${tail}
}
`,
        }),
      );
      expect(violations, `count read form: ${id}`).toHaveLength(1);
    }
  });

  // --- which client ------------------------------------------------------
  it("resolves a delegate reached through a destructured or aliased client", () => {
    for (const [id, prelude, receiver] of [
      ["destructured", "const { thing } = db;", "thing"],
      ["aliased-delegate", "const things = db.thing;", "things"],
    ] as const) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/client-${id}.ts`]: `
${prelude}
export async function claim() {
  const claimed = await ${receiver}.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`,
        }),
      );
      expect(violations, `receiver form: ${id}`).toHaveLength(1);
      // Resolving the receiver recovers the MODEL, so the finding is checked
      // against Thing's state columns rather than the fail-loud union.
      expect(violations[0]?.model, `receiver form: ${id}`).toBe("Thing");
      expect(violations[0]?.statePredicates).toEqual(["lifecyclePhase"]);
    }
  });

  // --- which client, inside a transaction --------------------------------
  it("refuses to certify a `tx` that is not the transaction callback's `tx`", () => {
    // The reverse misjudgement, and the worst kind: the guard did not merely
    // miss these, it CERTIFIED them as serialisable because the name matched.
    for (const [id, body] of [
      [
        "inner-block-shadow",
        `for (const item of items) {
      const tx = shards.for(item);
      const claimed = await tx.thing.updateMany({
        where: { id: "x", lifecyclePhase: "PENDING" },
        data: { lifecyclePhase: "CLAIMED" },
      });
      if (claimed.count !== 1) throw new Error("lost");
    }`,
      ],
      [
        "inner-callback-parameter",
        `await items.map(async (tx: any) => {
      const claimed = await tx.thing.updateMany({
        where: { id: "x", lifecyclePhase: "PENDING" },
        data: { lifecyclePhase: "CLAIMED" },
      });
      if (claimed.count !== 1) throw new Error("lost");
    });`,
      ],
      [
        "catch-binding",
        `try { throw new Error("x"); } catch (tx: any) {
      const claimed = await tx.thing.updateMany({
        where: { id: "x", lifecyclePhase: "PENDING" },
        data: { lifecyclePhase: "CLAIMED" },
      });
      if (claimed.count !== 1) throw new Error("lost");
    }`,
      ],
      // A declaration form is a binding too. Each of these shadows the
      // callback's `tx` for the whole block, so the write goes to the shadow —
      // and a walk that does not register the form resolves the receiver to the
      // callback parameter and certifies a write the transaction never sees.
      [
        "enum-shadow",
        `enum tx { A = "a" }
    ${SHADOWED_TX_WRITE}`,
      ],
      [
        "const-enum-shadow",
        `const enum tx { A = "a" }
    ${SHADOWED_TX_WRITE}`,
      ],
      [
        "namespace-shadow",
        `namespace tx { export const thing: any = null; }
    ${SHADOWED_TX_WRITE}`,
      ],
      [
        "module-keyword-shadow",
        `module tx { export const thing: any = null; }
    ${SHADOWED_TX_WRITE}`,
      ],
    ] as const) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/shadowed-${id}.ts`]: `
${PRISMA_IMPORT}
declare const items: any[];
declare const shards: any;
export async function claim() {
  return db.$transaction(async (tx) => {
    ${body}
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
`,
        }),
      );
      expect(violations, `shadow form: ${id}`).toHaveLength(1);
      expect(violations[0]?.reason, `shadow form: ${id}`).toBe(
        "ambient-client-inside-transaction",
      );
    }
  });

  it("CONTROL: the genuine transaction client is still certified", () => {
    const violations = checkConditionalUpdateCas(
      sandbox({
        "lib/real-tx.ts": `
${PRISMA_IMPORT}
export async function claim() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
`,
      }),
    );
    // Node identity must not become "refuse everything": the correct shape is
    // still proven, or the previous test proves nothing.
    expect(violations).toEqual([]);
  });

  // --- the isolation level -----------------------------------------------
  it("refuses an isolation level a later spread or duplicate key can override", () => {
    for (const [id, options] of [
      [
        "duplicate-key",
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }",
      ],
      [
        "later-spread",
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, ...overrides }",
      ],
      ["foreign-qualifier", "{ isolationLevel: levels.Serializable }"],
    ] as const) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/isolation-${id}.ts`]: `
${PRISMA_IMPORT}
declare const overrides: Record<string, unknown>;
const levels = { Serializable: "ReadCommitted" };
export async function claim() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, ${options});
}
`,
        }),
      );
      expect(violations, `isolation form: ${id}`).toHaveLength(1);
      expect(violations[0]?.reason, `isolation form: ${id}`).toBe(
        "isolation-not-serializable",
      );
    }
  });

  // An `enum`, a `const enum`, a `namespace`/`module` block and an
  // `import X = ...` bind a value name exactly as a `const` does. A scope walk
  // that recognises only the familiar forms steps PAST the shadow and answers
  // from an outer declaration — reading a `where` the call does not use, or a
  // `Serializable` options object it does not carry. Both channels are covered
  // because the same lookup serves both.
  it("stops at an enum, namespace or import-equals that shadows an outer const", () => {
    const SAFE_MUTATION = `{ where: { id: "x" }, data: { lifecyclePhase: "CLAIMED" } }`;
    const UNSAFE_WRITE = `const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");`;

    // Shadows that are legal inside a block.
    for (const [id, shadow] of [
      ["enum", `enum NAME { A = "a" }`],
      ["const-enum", `const enum NAME { A = "a" }`],
      ["namespace", `namespace NAME { export const A = "a"; }`],
      ["module-keyword", `module NAME { export const A = "a"; }`],
    ] as const) {
      // The updateMany ARGUMENT: the outer literal asserts no pre-state, so
      // borrowing it hides the site completely.
      const argument = checkConditionalUpdateCas(
        sandbox({
          [`lib/argument-shadow-${id}.ts`]: `
const mutation = ${SAFE_MUTATION};
export async function claim() {
  ${shadow.replace("NAME", "mutation")}
  const claimed = await db.thing.updateMany(mutation);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
        }),
      );
      expect(argument, `argument shadow: ${id}`).toHaveLength(1);
      expect(argument[0]?.reason, `argument shadow: ${id}`).toBe(
        "unanalyzable-argument",
      );

      // The $transaction OPTIONS argument: the outer literal proves
      // Serializable, so borrowing it CERTIFIES a transaction that declares
      // nothing of the sort.
      const options = checkConditionalUpdateCas(
        sandbox({
          [`lib/options-shadow-${id}.ts`]: `
${PRISMA_IMPORT}
const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
export async function claim() {
  ${shadow.replace("NAME", "options")}
  return db.$transaction(async (tx) => {
    ${UNSAFE_WRITE}
  }, options);
}
`,
        }),
      );
      expect(options, `options shadow: ${id}`).toHaveLength(1);
      expect(options[0]?.reason, `options shadow: ${id}`).toBe(
        "isolation-not-serializable",
      );
    }

    // `import X = ...` is legal only at the top level of a module or a
    // namespace body, so it shadows from inside a namespace.
    const importEquals = checkConditionalUpdateCas(
      sandbox({
        "lib/argument-shadow-import-equals.ts": `
declare namespace Legacy { const mutation: any; }
const mutation = ${SAFE_MUTATION};
export namespace Ops {
  import mutation = Legacy.mutation;
  export async function claim() {
    const claimed = await db.thing.updateMany(mutation);
    if (claimed.count !== 1) throw new Error("lost");
  }
}
`,
      }),
    );
    expect(importEquals).toHaveLength(1);
    expect(importEquals[0]?.reason).toBe("unanalyzable-argument");
  });

  // The mirror image: forms that do NOT bind a value name must not be mistaken
  // for a shadow, or the guard reports sites it can in fact read.
  it("CONTROL: a type-space or non-enclosing declaration is not a shadow", () => {
    for (const [id, extra] of [
      ["interface", `  interface mutation { a: string }`],
      ["type-alias", `  type mutation = { a: string };`],
      // `namespace Outer.mutation` binds `Outer` here and `mutation` only
      // INSIDE `Outer`, so the call's `mutation` is still the outer const.
      ["dotted-namespace-member", `}\nnamespace Outer.mutation { export const A = "a"; }\nexport function unused() {`],
      ["nested-block", `  { enum mutation { A = "a" } void mutation; }`],
      ["sibling-scope", `}\nexport function other() { enum mutation { A = "a" }; return mutation; }\nexport function unused() {`],
    ] as const) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/not-a-shadow-${id}.ts`]: `
const mutation = { where: { id: "x" }, data: { lifecyclePhase: "CLAIMED" } };
export async function claim() {
${extra}
  const claimed = await db.thing.updateMany(mutation);
  if (claimed.count !== 1) throw new Error("lost");
}
`,
        }),
      );
      expect(violations, `not a shadow: ${id}`).toEqual([]);
    }
  });

  // A qualifier that merely SPELLS the Prisma enum is not the Prisma enum. The
  // guard traces the root of the property access back to an import of the
  // generated client, because certification is what the reader trusts.
  it("refuses an isolation level whose qualifier is not the Prisma client's", () => {
    for (const [id, prelude, options] of [
      [
        "local-object-named-prisma",
        `const Prisma = { TransactionIsolationLevel: { Serializable: "ReadCommitted" } };`,
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }",
      ],
      [
        "local-object-named-enum",
        `const TransactionIsolationLevel = { Serializable: "ReadCommitted" };`,
        "{ isolationLevel: TransactionIsolationLevel.Serializable }",
      ],
      [
        "imported-from-elsewhere",
        `import { Prisma } from "@/lib/legacy-shims";`,
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }",
      ],
      [
        "unbound-identifier",
        `declare const unrelated: string;`,
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }",
      ],
    ] as const) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/qualifier-${id}.ts`]: `
${prelude}
export async function claim() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, ${options});
}
`,
        }),
      );
      expect(violations, `qualifier form: ${id}`).toHaveLength(1);
      expect(violations[0]?.reason, `qualifier form: ${id}`).toBe(
        "isolation-not-serializable",
      );
    }
  });

  it("CONTROL: every spelling that really is the Prisma enum stays certified", () => {
    for (const [id, prelude, options] of [
      [
        "namespace-object",
        PRISMA_IMPORT,
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }",
      ],
      [
        "enum-imported-directly",
        `import { TransactionIsolationLevel } from "@prisma/client";`,
        "{ isolationLevel: TransactionIsolationLevel.Serializable }",
      ],
      [
        "namespace-import",
        `import * as PrismaClient from "@prisma/client";`,
        "{ isolationLevel: PrismaClient.TransactionIsolationLevel.Serializable }",
      ],
      [
        "import-equals-require",
        `import Prisma = require("@prisma/client");`,
        "{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }",
      ],
      // Prisma accepts the bare string, and a string cannot denote anything
      // other than itself.
      ["string-literal", `declare const unrelated: string;`, `{ isolationLevel: "Serializable" }`],
    ] as const) {
      const violations = checkConditionalUpdateCas(
        sandbox({
          [`lib/proven-${id}.ts`]: `
${prelude}
export async function claim() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", lifecyclePhase: "PENDING" },
      data: { lifecyclePhase: "CLAIMED" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, ${options});
}
`,
        }),
      );
      // Tightening the qualifier must not become "refuse everything": the real
      // spellings are what the previous test is measured against.
      expect(violations, `proven form: ${id}`).toEqual([]);
    }
  });
});

describe("fail-closed scan boundaries", () => {
  it("flags an updateMany result returned directly to an unseen caller", () => {
    const root = sandbox({
      "lib/returned-helper.ts": `
export async function claim() {
  return db.thing.updateMany({
    where: { id: "x", lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
}
`,
    });

    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.resultVariable).toBe("<inline-count>");
    expect(violations[0]?.reason).toBe("no-transaction");
  });

  it("flags an updateMany result returned by an expression-body helper", () => {
    const root = sandbox({
      "lib/returned-arrow-helper.ts": `
export const claim = () => db.thing.updateMany({
  where: { id: "x", lifecyclePhase: "PENDING" },
  data: { lifecyclePhase: "CLAIMED" },
});
`,
    });

    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.resultVariable).toBe("<inline-count>");
    expect(violations[0]?.reason).toBe("no-transaction");
  });

  it("throws when the Prisma schema cannot be read", () => {
    const root = sandbox({ "lib/claim.ts": CAS_WITH_DERIVED_ENUM });
    rmSync(path.join(root, "prisma/schema.prisma"));

    expect(() => collectConditionalUpdateCasFindings(root)).toThrow(
      /cannot read Prisma schema/u,
    );
  });

  it("throws when an existing scan root cannot be traversed", () => {
    const root = sandbox({
      "lib/safe.ts": "export const safe = true;",
      features: "this path is a file, not a directory",
    });

    expect(() => collectConditionalUpdateCasFindings(root)).toThrow(
      /cannot traverse scan root/u,
    );
  });

  it("throws instead of certifying a source file with parse errors", () => {
    const root = sandbox({
      "lib/broken.ts": `
export async function claim( {
  return db.thing.updateMany({
    where: { lifecyclePhase: "PENDING" },
    data: { lifecyclePhase: "CLAIMED" },
  });
}
`,
    });

    expect(() => collectConditionalUpdateCasFindings(root)).toThrow(
      /cannot analyze TypeScript/u,
    );
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
