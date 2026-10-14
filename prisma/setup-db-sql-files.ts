import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export function walkSqlFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSqlFiles(full, acc);
    } else if (entry.endsWith(".sql")) {
      acc.push(full);
    }
  }
  return acc;
}

export function splitSqlStatements(content: string): string[] {
  return content
    .replace(/^\s*--.*$/gm, "")
    .split(/;[\t ]*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function listExtensionSetupSqlFiles(extensionsRoot: string): string[] {
  return walkSqlFiles(extensionsRoot)
    .filter((file) => path.relative(extensionsRoot, file).split(path.sep)[2] === "sql")
    // Fixtures, rollback scripts, and SQL packages with client-side directives
    // or prepared-statement control flow have dedicated runners. Prisma's
    // startup executor sends one statement per call and cannot execute them.
    .filter((file) => !/\.(?:test|spec|rollback)\.sql$/i.test(file))
    .filter((file) => {
      const activeSql = readFileSync(file, "utf8").replace(/^\s*--.*$/gm, "");
      return !/^\s*(?:DELIMITER\b|PREPARE\b|EXECUTE\b|DEALLOCATE\s+PREPARE\b|CREATE\s+PROCEDURE\b|DROP\s+PROCEDURE\b)/im.test(activeSql);
    })
    // Create base tables before additive ALTER/seed files so lexical filenames
    // cannot make a fresh install apply an upgrade before its table exists.
    .sort((left, right) => {
      const rank = (file: string) => {
        const sql = readFileSync(file, "utf8").replace(/^\s*--.*$/gm, "");
        return /^\s*CREATE\s+TABLE\b/i.test(sql) ? 0 : 1;
      };
      return rank(left) - rank(right) || left.localeCompare(right);
    });
}

export function isIgnorableExtensionSetupSqlError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Code: `1060`") ||
    msg.includes("Code: `1061`") ||
    msg.includes("Duplicate column name") ||
    msg.includes("Duplicate key name")
  );
}
