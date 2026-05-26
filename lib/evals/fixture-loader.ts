import { readFileSync } from "node:fs";
import path from "node:path";

export function loadEvalFixture<T>(relativePath: string): T {
  const fullPath = path.join(process.cwd(), relativePath);
  const content = readFileSync(fullPath, "utf8");
  return JSON.parse(content) as T;
}
