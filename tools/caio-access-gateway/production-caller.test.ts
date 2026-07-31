// Regression guard: the CAIO access gateway protocol core must have a
// NON-TEST production caller.
//
// The gateway handler (createCaioGatewayHandler) once existed with no caller
// outside its own directory and its own tests: a protocol core nothing
// composed, so every claim about its behaviour was a claim about test wiring
// only. This file fails if that state ever returns — either because the
// composition stops mounting the handler, or because the composition module
// disappears.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** The composition that owns the single TLS listener. */
const COMPOSITION = path.join("tools", "caio-access-gateway", "server.ts");

/** Where the handler is DEFINED; defining it is not calling it. */
const DEFINITION = path.join(
  "lib",
  "caio-access-gateway",
  "gateway-http-core.ts",
);

const SCANNED_ROOTS = ["app", "features", "lib", "scripts", "tools"];

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
      continue;
    }
    if (!full.endsWith(".ts") && !full.endsWith(".tsx")) continue;
    if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) continue;
    found.push(full);
  }
  return found;
}

function productionCallers(): string[] {
  const callers: string[] = [];
  for (const root of SCANNED_ROOTS) {
    const absoluteRoot = path.join(REPO_ROOT, root);
    for (const file of walk(absoluteRoot)) {
      const relative = path.relative(REPO_ROOT, file);
      if (relative === DEFINITION) continue;
      if (readFileSync(file, "utf8").includes("createCaioGatewayHandler(")) {
        callers.push(relative);
      }
    }
  }
  return callers.sort();
}

describe("the gateway protocol core has a production caller", () => {
  it("is called from at least one non-test module outside its own definition", () => {
    const callers = productionCallers();
    expect(callers.length).toBeGreaterThan(0);
    expect(callers).toContain(COMPOSITION);
  });

  it("the composition mounts the handler and owns exactly one listener", () => {
    const source = readFileSync(path.join(REPO_ROOT, COMPOSITION), "utf8");
    // Imported from the protocol core, not re-declared locally.
    expect(source).toMatch(
      /import[\s\S]*createCaioGatewayHandler[\s\S]*from "@\/lib\/caio-access-gateway\/gateway-http-core"/,
    );
    // Mounted exactly once: one handler, one listener.
    expect(source.match(/createCaioGatewayHandler\(/g)).toHaveLength(1);
    expect(source.match(/listenerFactory\(/g)).toHaveLength(1);
  });
});
