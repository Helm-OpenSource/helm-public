import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkConditionalUpdateCas } from "./check-conditional-update-cas";

const roots: string[] = [];

function sandbox(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "cas-guard-"));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

const CAS_WITH_STATE = `
export async function claim() {
  const claimed = await db.thing.updateMany({
    where: { id: "x", status: "pending" },
    data: { status: "claimed" },
  });
  if (claimed.count !== 1) throw new Error("lost");
}
`;

const ID_ONLY = `
export async function touch() {
  const updated = await db.thing.updateMany({
    where: { id: "x" },
    data: { seenAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("missing");
}
`;

const INSIDE_TRANSACTION = `
export async function claimInTx() {
  return db.$transaction(async (tx) => {
    const claimed = await tx.thing.updateMany({
      where: { id: "x", status: "pending" },
      data: { status: "claimed" },
    });
    if (claimed.count !== 1) throw new Error("lost");
  }, TRANSACTION_OPTIONS);
}
`;

const ATOMIC_RAW = `
export async function claimAtomically() {
  const affected = Number(
    await db.$executeRaw\`
      UPDATE \\\`Thing\\\` SET \\\`status\\\` = 'claimed'
       WHERE \\\`id\\\` = \${id} AND \\\`status\\\` = 'pending'
    \`,
  );
  if (affected !== 1) throw new Error("lost");
}
`;

describe("conditional-update compare-and-swap guard", () => {
  it("flags an untransacted conditional updateMany read as a CAS", () => {
    const root = sandbox({ "lib/claim.ts": CAS_WITH_STATE });
    const violations = checkConditionalUpdateCas(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("lib/claim.ts");
    expect(violations[0]?.statePredicates).toEqual(["status"]);
  });

  it("ignores an update addressed by primary key alone", () => {
    const root = sandbox({ "lib/touch.ts": ID_ONLY });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("ignores a conditional update held inside a transaction", () => {
    const root = sandbox({ "lib/tx.ts": INSIDE_TRANSACTION });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("accepts the atomic raw statement that replaces the pattern", () => {
    const root = sandbox({ "lib/atomic.ts": ATOMIC_RAW });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });

  it("suppresses a baselined file but still counts it when the baseline is ignored", () => {
    const root = sandbox({
      "lib/claim.ts": CAS_WITH_STATE,
      "scripts/conditional-update-cas-baseline.json": `${JSON.stringify(
        { entries: [{ file: "lib/claim.ts", statePredicates: ["status"] }] },
        null,
        2,
      )}\n`,
    });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
    expect(
      checkConditionalUpdateCas(root, { ignoreBaseline: true }),
    ).toHaveLength(1);
  });

  it("still flags a NEW violation in a file that is not baselined", () => {
    const root = sandbox({
      "lib/claim.ts": CAS_WITH_STATE,
      "lib/fresh.ts": CAS_WITH_STATE,
      "scripts/conditional-update-cas-baseline.json": `${JSON.stringify(
        { entries: [{ file: "lib/claim.ts", statePredicates: ["status"] }] },
        null,
        2,
      )}\n`,
    });
    const violations = checkConditionalUpdateCas(root);
    expect(violations.map((violation) => violation.file)).toEqual([
      "lib/fresh.ts",
    ]);
  });

  it("does not treat a test file as production code", () => {
    const root = sandbox({ "lib/claim.test.ts": CAS_WITH_STATE });
    expect(checkConditionalUpdateCas(root)).toEqual([]);
  });
});
