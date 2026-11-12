// lib/seat-device/password-write-gate.test.ts
// Gate (design D1 §4.6, P2-8): every write of User.passwordHash in Core's
// lib, features and app sets passwordSetAt in the same write. A seat device
// keeps the passwordSetAt it was approved under and stops working once the
// value differs, so a password reset that forgot the stamp would leave every
// device of the member alive.
//
// Heuristic by design: it finds Prisma `<client>.user.<write>(...)` calls
// and raw `UPDATE User SET` / `INSERT INTO User (...)` statements (with
// plain, quoted or escaped-backtick identifiers, as written inside a tagged
// template), and checks each data/create/update object (or statement) that
// names passwordHash for passwordSetAt. A data/create/update value it cannot
// read (a variable, a shorthand, a call) fails closed: the write must spell
// its object out. A nested write into User from another model's call is not
// seen. The extension's own User writes live in its
// repository and are gated there.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SCANNED_DIRECTORIES = ["lib", "features", "app"];
const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const TEST_FILE = /\.test\.[a-z]+$/;

const USER_WRITE = /\.user\.(?:create|createMany|update|updateMany|upsert)\s*\(/g;
// A write key and the first character of its value; shorthand `data,` or
// `data }` has none.
const WRITE_KEY = /\b(?:data|create|update)\b\s*(?::\s*(\S)|(?=[,}]))/g;
// An identifier may be bare, quoted, or a backtick escaped inside a template.
const SQL_USER_UPDATE = /\bUPDATE\s+(?:\\?[`"])?User(?:\\?[`"])?\s+SET\b/gi;
const SQL_USER_INSERT = /\bINSERT\s+INTO\s+(?:\\?[`"])?User(?:\\?[`"])?\s*\(/gi;

type PasswordWrite = { line: number; setsPasswordSetAt: boolean; unreadable?: true };

// Text from the bracket at `open` to its partner (same bracket kind only;
// strings are not parsed, which is enough for the write shapes in use).
function enclosed(text: string, open: number): string | null {
  const opening = text[open];
  const closing = opening === "(" ? ")" : "}";
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === opening) depth += 1;
    else if (text[index] === closing && (depth -= 1) === 0) return text.slice(open, index + 1);
  }
  return null;
}

const lineOf = (text: string, offset: number) => text.slice(0, offset).split("\n").length;

export function findPasswordWrites(source: string): PasswordWrite[] {
  const writes: PasswordWrite[] = [];
  const record = (offset: number, body: string) => {
    if (/\bpasswordHash\b/.test(body)) writes.push({ line: lineOf(source, offset), setsPasswordSetAt: /\bpasswordSetAt\b/.test(body) });
  };
  for (const call of source.matchAll(USER_WRITE)) {
    const args = enclosed(source, call.index + call[0].length - 1);
    if (!args) continue;
    for (const key of args.matchAll(WRITE_KEY)) {
      const body = key[1] === "{" ? enclosed(args, key.index + key[0].length - 1) : null;
      if (body) record(call.index, body);
      else writes.push({ line: lineOf(source, call.index), setsPasswordSetAt: false, unreadable: true });
    }
  }
  for (const statement of source.matchAll(SQL_USER_UPDATE)) {
    const rest = source.slice(statement.index);
    const end = rest.search(/\bWHERE\b|;|(?<!\\)`\s*[,)]/i);
    record(statement.index, end === -1 ? rest : rest.slice(0, end));
  }
  for (const statement of source.matchAll(SQL_USER_INSERT)) {
    const columns = enclosed(source, statement.index + statement[0].length - 1);
    if (columns) record(statement.index, columns);
  }
  return writes;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    if (statSync(absolute).isDirectory()) return sourceFiles(absolute);
    return SOURCE_FILE.test(entry) && !TEST_FILE.test(entry) ? [absolute] : [];
  });
}

describe("password write gate", () => {
  it("finds no User write of passwordHash without passwordSetAt in lib, features or app", () => {
    const found = SCANNED_DIRECTORIES.flatMap((directory) => sourceFiles(path.join(ROOT, directory))).flatMap((file) =>
      findPasswordWrites(readFileSync(file, "utf8")).map((write) => ({ file: path.relative(ROOT, file), ...write })),
    );
    expect(found.filter((write) => !write.setsPasswordSetAt)).toEqual([]);
    // The known write points (design §2.1) are seen, so the scan cannot go
    // quietly blind after a refactor.
    const files = new Set(found.map((write) => write.file));
    expect(files).toContain("features/auth/actions.ts");
    expect(files).toContain("lib/auth/member-activation.service.ts");
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it("flags a write without the stamp and ignores reads and other models", () => {
    const flagged = (source: string) => findPasswordWrites(source).map((write) => write.setsPasswordSetAt);
    expect(flagged("await db.user.update({ where: { id }, data: { passwordHash: next } });")).toEqual([false]);
    expect(flagged("await tx.user.updateMany({ where: { id, passwordHash: null }, data: { passwordHash, passwordSetAt: now } });")).toEqual([true]);
    expect(flagged("db.user.upsert({ where, create: { email, passwordHash, passwordSetAt: now }, update: { passwordHash } })")).toEqual([true, false]);
    expect(flagged("db.user.findUnique({ where: { id }, select: { passwordHash: true } })")).toEqual([]);
    expect(flagged("db.authEnrollment.create({ data: { email, passwordHash: hash } })")).toEqual([]);
    expect(flagged("tx.$executeRaw`UPDATE `User` SET `passwordHash` = ${hash} WHERE `id` = ${id}`")).toEqual([false]);
    expect(flagged("tx.$executeRaw`UPDATE User SET passwordHash = ?, passwordSetAt = ? WHERE id = ?`")).toEqual([true]);
    expect(flagged("INSERT INTO `User` (`id`, `email`, `passwordHash`) VALUES (?, ?, ?)")).toEqual([false]);
    // Raw SQL inside a tagged template, as the repository writes it.
    expect(flagged("tx.$executeRaw`UPDATE \\`User\\` SET \\`passwordHash\\` = ${hash} WHERE \\`id\\` = ${id}`")).toEqual([false]);
    expect(flagged("tx.$executeRaw`UPDATE \\`User\\` SET \\`passwordHash\\` = ${hash}, \\`passwordSetAt\\` = ${now} WHERE \\`id\\` = ${id}`")).toEqual([true]);
    expect(flagged("tx.$executeRaw`INSERT INTO \\`User\\` (\\`id\\`, \\`passwordHash\\`) VALUES (${id}, ${hash})`")).toEqual([false]);
    // A write object the gate cannot read fails closed, password or not.
    expect(findPasswordWrites("const data = { passwordHash: next }; await db.user.update({ where: { id }, data });")).toEqual([{ line: 1, setsPasswordSetAt: false, unreadable: true }]);
    expect(flagged("await db.user.update({ where: { id }, data: buildUserPatch(input) });")).toEqual([false]);
    expect(flagged("await db.user.upsert({ where, create: createInput, update: { name } });")).toEqual([false]);
  });
});
