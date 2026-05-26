import { readdirSync, statSync } from "node:fs";
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

export function listExtensionSetupSqlFiles(extensionsRoot: string): string[] {
  return walkSqlFiles(extensionsRoot)
    .filter((file) => path.relative(extensionsRoot, file).split(path.sep)[2] === "sql")
    .sort();
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
