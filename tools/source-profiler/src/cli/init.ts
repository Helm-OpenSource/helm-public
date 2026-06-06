/**
 * Source Profiler — `init` command.
 *
 * Scaffolds a scope manifest template and ensures `.helm-profiler/` is
 * gitignored so user-private run outputs never get committed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultScopeManifest } from "../contract/scope-manifest";

export type InitInput = {
  cwd: string;
  scopePath?: string;
  force: boolean;
};

export type InitResult = {
  scopePath: string;
  scopeWritten: boolean;
  gitignoreUpdated: boolean;
  messages: string[];
};

const DEFAULT_SCOPE_REL = ".helm-profiler/source-profiler.scope.json";
const GITIGNORE_ENTRY = ".helm-profiler/";

export function runInit({ cwd, scopePath, force }: InitInput): InitResult {
  const messages: string[] = [];
  const scopeAbs = path.resolve(cwd, scopePath ?? DEFAULT_SCOPE_REL);

  mkdirSync(path.dirname(scopeAbs), { recursive: true });

  let scopeWritten = false;
  if (existsSync(scopeAbs) && !force) {
    messages.push(`scope manifest already exists: ${rel(cwd, scopeAbs)} (use --force to overwrite)`);
  } else {
    const template = defaultScopeManifest(".");
    writeFileSync(scopeAbs, `${JSON.stringify(template, null, 2)}\n`, "utf8");
    scopeWritten = true;
    messages.push(`wrote scope manifest template: ${rel(cwd, scopeAbs)}`);
  }

  const gitignoreUpdated = ensureGitignore(cwd, messages);
  return { scopePath: scopeAbs, scopeWritten, gitignoreUpdated, messages };
}

function ensureGitignore(cwd: string, messages: string[]): boolean {
  const gitignoreAbs = path.join(cwd, ".gitignore");
  let lines: string[] = [];
  if (existsSync(gitignoreAbs)) {
    lines = readFileSync(gitignoreAbs, "utf8").split(/\r?\n/);
    if (lines.some((l) => l.trim() === GITIGNORE_ENTRY || l.trim() === ".helm-profiler")) {
      messages.push(".gitignore already ignores .helm-profiler/");
      return false;
    }
  }
  const addition = `${lines.length && lines[lines.length - 1] !== "" ? "\n" : ""}# Source Profiler private run outputs\n${GITIGNORE_ENTRY}\n`;
  writeFileSync(gitignoreAbs, `${existsSync(gitignoreAbs) ? readFileSync(gitignoreAbs, "utf8") : ""}${addition}`, "utf8");
  messages.push("added .helm-profiler/ to .gitignore");
  return true;
}

function rel(cwd: string, abs: string): string {
  return path.relative(cwd, abs) || abs;
}
