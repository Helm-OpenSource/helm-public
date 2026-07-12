/**
 * Source Profiler boundary guard.
 *
 * Static text scan (no AST) enforcing the tool's hard boundaries. Strict:
 * prefers false-positives over false-negatives. Each rule supports an inline
 * `@bypass-<ruleId>` escape hatch (which must also be justified in the PR).
 *
 * LIMITS: this is a token scan, not a sandbox. Deliberately obfuscated forms —
 * string-concatenated identifiers (`globalThis['ev'+'al']`),
 * reflection (`constructor.constructor`), aliasing (`const f = fetch; f()`), or
 * computed member access — can evade it. The guard is defense-in-depth; the real
 * guarantees are (1) the deterministic core is no-network/no-exec by
 * construction, (2) all external I/O is injected (executors/transports — no
 * bundled DB driver or `fetch`), and (3) the tool is open-source and auditable.
 *
 * Rules:
 *   SP-A no-exec       — no code execution anywhere in the tool (eval, Function,
 *                        child_process, vm, dynamic require/import of code).
 *   SP-B no-network    — the deterministic core (src/profiler, src/util, src/cli,
 *                        src/contract) performs no network I/O. Network is only
 *                        sanctioned under src/ai/** (consent-gated) and src/db/**.
 *   SP-C candidate-only— AI overlay files (src/ai/**) may not assert acceptance
 *                        or claim deterministic origin (AI output is never truth).
 *   SP-D synthetic     — fixtures contain no real secrets/PII.
 *   SP-E no-authority  — proposer/overlay code cannot import or call execution,
 *                        approval, feedback, promotion, writeback, or activation paths.
 *   SP-F projected-only— a full ReviewPacket cannot be serialized or dispatched
 *                        to an AI provider/transport.
 *
 * Exit code 0 = pass, 1 = violations found.
 *
 * NOT typechecked by tsconfig.public.json (scripts/** is excluded), consistent
 * with the repo's other guard scripts; covered by a vitest unit test.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

export type Violation = { rule: string; file: string; line: number; detail: string };

const TOOL_ROOT_REL = "tools/source-profiler";

const EXEC_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "eval", re: /\beval\s*\(/ },
  // Catch both `new Function(` and a bare `Function(` call (not a `.Function(`
  // method access).
  { id: "function-ctor", re: /(^|[^.\w])Function\s*\(/ },
  { id: "child_process", re: /child_process/ },
  // Note: bare `exec(` is intentionally NOT banned — it false-matches
  // RegExp.prototype.exec. child_process import is caught above; the distinctive
  // exec* variants below cannot be a regex method.
  { id: "exec-sync", re: /\b(execSync|execFile|execFileSync)\s*\(/ },
  { id: "spawn", re: /\bspawn(Sync)?\s*\(/ },
  { id: "vm", re: /\bnode:vm\b|\brequire\(['"]vm['"]\)/ },
  // Any dynamic import()/require() — literal or computed — is disallowed in the
  // tool (it never code-splits or loads modules at runtime).
  { id: "dynamic-import", re: /\bimport\s*\(/ },
  { id: "dynamic-require", re: /\brequire\s*\(/ },
];

const NETWORK_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "fetch", re: /\bfetch\s*\(/ },
  { id: "node-http", re: /\bnode:(http|https|net|dgram|tls)\b/ },
  { id: "require-net", re: /\brequire\s*\(\s*['"](node:)?(http|https|net|dgram|tls)['"]\s*\)/ },
  { id: "import-net", re: /\bimport\s*\(\s*['"](node:)?(http|https|net|dgram|tls)['"]\s*\)/ },
  { id: "import-net-static", re: /\bfrom\s+['"](node:)?(http|https|net|dgram|tls)['"]/ },
  { id: "xhr", re: /\bXMLHttpRequest\b/ },
  { id: "ws", re: /\bnew\s+WebSocket\s*\(/ },
];

// Tooling — deterministic OR ai — must never finalize a human decision.
const ACCEPTED_STATE_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "asserts-accepted", re: /state\s*:\s*['"]accepted_by_human['"]/ },
  { id: "asserts-rejected", re: /state\s*:\s*['"]rejected_by_human['"]/ },
];

const UNSAFE_V3_STATE_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  {
    id: "unsafe-v3-review-state",
    re: /reviewState\s*:\s*['"](?:approved|committed|executed|auto_promote|production_ready)['"]/i,
  },
];

const AUTHORITY_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "crm-import", re: /\brunCrmImport\s*\(|crm-orchestrator\.service/ },
  { id: "connector-activation", re: /\bactivateConnector\s*\(|features\/connectors\/actions/ },
  { id: "approval-create", re: /\b(?:createApprovalTask|approvalTask\.create)\s*\(/ },
  { id: "external-send", re: /\b(?:externalSend|sendEmail)\s*\(/ },
  { id: "writeback", re: /\bwriteback\s*\(/i },
  {
    id: "learning-write",
    re: /\b(?:memoryPromotion|preferenceSignal|patternFact|recommendationFeedback)\.(?:create|update|upsert)\s*\(/,
  },
];

const RAW_PACKET_EGRESS_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  {
    id: "packet-provider-dispatch",
    re: /\b(?:provider\.suggest|transport)\s*\(\s*(?:input\.)?(?:packet|reviewPacket)\b/,
  },
  {
    id: "packet-serialization",
    re: /JSON\.stringify\s*\(\s*(?:input\.)?(?:packet|reviewPacket)\b/,
  },
];

// Reused from the profiler's own secret rules (kept in sync conceptually).
const FIXTURE_SECRET_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "aws_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "url_credential", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/i },
  { id: "connection_string", re: /\b(mysql|postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s"']+/i },
];

export function runSourceProfilerBoundariesCheck(repoRoot: string): Violation[] {
  const toolRoot = path.join(repoRoot, TOOL_ROOT_REL);
  if (!existsSync(toolRoot)) return [];
  const violations: Violation[] = [];
  const files = listFiles(toolRoot).filter((f) => /\.(ts|tsx|json|md)$/.test(f));

  for (const abs of files) {
    const rel = toPosix(path.relative(repoRoot, abs));
    const isTest = /\.test\.ts$/.test(rel);
    const isFixture = rel.includes("/fixtures/");
    const inAiDir = rel.includes("/src/ai/");
    const inDbDir = rel.includes("/src/db/");
    const content = safeRead(abs);
    if (content === null) continue;
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isFixture) {
        check(FIXTURE_SECRET_PATTERNS, line, i, rel, "SP-D", violations);
        continue;
      }
      if (isTest) continue; // tests may reference banned tokens as assertions
      // Any @bypass-* must carry a justification on the same line.
      const bypass = line.match(/@bypass-([A-Za-z0-9-]+)\b(.*)$/);
      if (bypass && bypass[2].trim().length === 0) {
        violations.push({ rule: "SP-BYPASS", file: rel, line: i + 1, detail: `@bypass-${bypass[1]} without justification` });
      }
      // SP-A no-exec everywhere in the tool source.
      check(EXEC_PATTERNS, line, i, rel, "SP-A", violations);
      // SP-B no-network in the deterministic core only (ai/db are sanctioned I/O).
      if (!inAiDir && !inDbDir) {
        check(NETWORK_PATTERNS, line, i, rel, "SP-B", violations);
      }
      // SP-C-state: tooling never finalizes a human decision — anywhere in the tool.
      check(ACCEPTED_STATE_PATTERNS, line, i, rel, "SP-C", violations);
      check(UNSAFE_V3_STATE_PATTERNS, line, i, rel, "SP-C", violations);
      // SP-C-origin: AI overlay must not claim deterministic origin.
      if (inAiDir && /origin\s*:\s*['"]deterministic['"]/.test(line)) {
        pushIfNotBypassed(violations, "SP-C", rel, i, line, "ai output claims deterministic origin");
      }
      check(AUTHORITY_PATTERNS, line, i, rel, "SP-E", violations);
      if (inAiDir) {
        check(RAW_PACKET_EGRESS_PATTERNS, line, i, rel, "SP-F", violations);
      }
    }
  }
  return violations;
}

function check(
  patterns: ReadonlyArray<{ id: string; re: RegExp }>,
  line: string,
  lineIndex: number,
  rel: string,
  rule: string,
  violations: Violation[],
): void {
  for (const { id, re } of patterns) {
    if (re.test(line)) {
      pushIfNotBypassed(violations, rule, rel, lineIndex, line, id);
    }
  }
}

function pushIfNotBypassed(
  violations: Violation[],
  rule: string,
  file: string,
  lineIndex: number,
  line: string,
  detail: string,
): void {
  if (line.includes(`@bypass-${rule}`)) return;
  violations.push({ rule, file, line: lineIndex + 1, detail });
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        stack.push(abs);
      } else if (entry.isFile()) {
        out.push(abs);
      }
    }
  }
  return out.sort();
}

function safeRead(abs: string): string | null {
  try {
    if (statSync(abs).size > 5 * 1024 * 1024) return null;
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function isMain(): boolean {
  const entry = process.argv[1] ?? "";
  return /check-source-profiler-boundaries\.ts$/.test(entry);
}

if (isMain()) {
  const repoRoot = process.cwd();
  const violations = runSourceProfilerBoundariesCheck(repoRoot);
  if (violations.length === 0) {
    process.stdout.write("source-profiler-boundaries: PASS\n");
    process.exit(0);
  }
  process.stderr.write(`source-profiler-boundaries: FAIL — ${violations.length} violation(s)\n`);
  for (const v of violations) {
    process.stderr.write(`  [${v.rule}] ${v.file}:${v.line} — ${v.detail}\n`);
  }
  process.exit(1);
}
