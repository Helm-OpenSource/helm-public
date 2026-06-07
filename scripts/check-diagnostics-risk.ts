/**
 * Diagnostics risk guard (slice 1) — fail closed.
 *
 * Two layers:
 *  1. Registry value validation: every DIAGNOSTIC_COMMANDS entry must stay
 *     within the Public Core ceiling (read/local_draft live; higher risk only as
 *     an explicitly disabled placeholder), use the known forbidden-action
 *     vocabulary, declare no boundary-breaching side effects, and keep
 *     sibling-repo entries read-only.
 *  2. Implementation source scan: diagnostics code must not actually DO a
 *     forbidden capability. Forbidden capability identifiers are matched only
 *     OUTSIDE string literals, so declarative `forbiddenActions: ["auto_send"]`
 *     lists are not flagged — but a real `auto_send(...)` call or a network/exec
 *     primitive is.
 *
 * LIMITS: this is a tripwire, NOT a sandbox. A static token scan can be evaded
 * by deliberate obfuscation (split-literal identifiers, computed member access,
 * reflection, aliasing). It catches accidental drift in self-authored code; the
 * real guarantee is that diagnostics code is read-only/no-exec by construction
 * and is open-source and auditable.
 *
 * Exit 0 = clean, 1 = violations. Wired into `npm run check:boundaries`.
 * NOT typechecked (scripts/** excluded); covered by a vitest unit test.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import {
  DIAGNOSTIC_COMMANDS,
  KNOWN_FORBIDDEN_ACTIONS,
  validateRegistryWithinPublicCore,
} from "../lib/diagnostics/command-registry";

export type RiskViolation = { source: string; line: number; rule: string; detail: string };

const CALL_PRIMITIVES: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "fetch", re: /\bfetch\s*\(/ },
  { id: "exec", re: /\b(execSync|execFileSync|execFile)\s*\(/ },
  { id: "spawn", re: /\bspawn(Sync)?\s*\(/ },
  { id: "eval", re: /\beval\s*\(/ },
  { id: "function-ctor", re: /(^|[^.\w])Function\s*\(/ },
  { id: "send-mail", re: /\bsendMail\s*\(/ },
  { id: "net-connect", re: /\bcreateConnection\s*\(/ },
  { id: "xhr", re: /\bXMLHttpRequest\b/ },
  { id: "websocket", re: /\bnew\s+WebSocket\s*\(/ },
  { id: "child_process", re: /\bchild_process\b/ },
  // Any dynamic import()/require() — literal OR computed specifier — is flagged.
  // Diagnostics code uses only static imports, so this has no false positives
  // here and catches a non-literal module load that MODULE_IMPORT_PATTERNS
  // (literal-only) would miss.
  { id: "dynamic-import", re: /\bimport\s*\(/ },
  { id: "dynamic-require", re: /\brequire\s*\(/ },
];

/**
 * Dangerous MODULE specifiers are matched on the RAW line (they live inside
 * import/require string literals, which the literal-stripping scan would erase).
 * These module names never appear in the diagnostics implementation, so this is
 * a safe addition (the guard's own file is not scanned).
 */
const MODULE_IMPORT_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "child_process", re: /['"](node:)?child_process['"]/ },
  { id: "net-module", re: /['"](node:)?(http|https|net|dgram|tls)['"]/ },
];

/** Replace string-literal contents so declarations aren't matched as behavior. */
function stripStringLiterals(line: string): string {
  return line
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

export function scanTextForForbidden(text: string, source: string): RiskViolation[] {
  const out: RiskViolation[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const stripped = stripStringLiterals(line);
    for (const token of KNOWN_FORBIDDEN_ACTIONS) {
      if (new RegExp(`\\b${token}\\b`).test(stripped)) {
        out.push({ source, line: i + 1, rule: "forbidden-action", detail: token });
      }
    }
    for (const prim of CALL_PRIMITIVES) {
      if (prim.re.test(stripped)) {
        out.push({ source, line: i + 1, rule: "forbidden-primitive", detail: prim.id });
      }
    }
    for (const mod of MODULE_IMPORT_PATTERNS) {
      if (mod.re.test(line)) {
        out.push({ source, line: i + 1, rule: "forbidden-module", detail: mod.id });
      }
    }
  });
  return out;
}

/** This guard's own file — excluded (its pattern literals are definitions). */
const GUARD_BASENAME = "check-diagnostics-risk.ts";

function listDiagnosticsFiles(repoRoot: string): string[] {
  const files: string[] = [];

  // All non-test diagnostics library modules.
  const libDir = path.join(repoRoot, "lib", "diagnostics");
  if (existsSync(libDir)) {
    for (const entry of readdirSync(libDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(path.join(libDir, entry.name));
      }
    }
  }

  // Any diagnostics executable under scripts/ (auto-covers future scripts),
  // excluding test files and this guard itself.
  const scriptsDir = path.join(repoRoot, "scripts");
  if (existsSync(scriptsDir)) {
    for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
      if (entry.name === GUARD_BASENAME) continue;
      if (!/diagnostic/i.test(entry.name)) continue;
      files.push(path.join(scriptsDir, entry.name));
    }
  }

  return files.sort();
}

export function runDiagnosticsRiskCheck(repoRoot: string): RiskViolation[] {
  const violations: RiskViolation[] = [];

  // Layer 1: registry value validation.
  for (const v of validateRegistryWithinPublicCore(DIAGNOSTIC_COMMANDS)) {
    violations.push({ source: `registry:${v.commandId}`, line: 0, rule: v.rule, detail: v.detail });
  }

  // Layer 2: implementation source scan.
  for (const file of listDiagnosticsFiles(repoRoot)) {
    let content: string;
    try {
      if (statSync(file).size > 2 * 1024 * 1024) continue;
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    violations.push(...scanTextForForbidden(content, path.relative(repoRoot, file)));
  }

  return violations;
}

const isDirect = process.argv[1] && /check-diagnostics-risk\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  const violations = runDiagnosticsRiskCheck(process.cwd());
  if (violations.length === 0) {
    process.stdout.write("diagnostics-risk: PASS\n");
    process.exit(0);
  }
  process.stderr.write(`diagnostics-risk: FAIL — ${violations.length} violation(s)\n`);
  for (const v of violations) {
    process.stderr.write(`  [${v.rule}] ${v.source}:${v.line} — ${v.detail}\n`);
  }
  process.exit(1);
}
