// Regression guard: the CAIO access gateway protocol core must have a
// NON-TEST production caller, and its header must keep telling the truth about
// what V1 serves.
//
// The gateway handler (createCaioGatewayHandler) once existed with no caller
// outside its own directory and its own tests: a protocol core nothing
// composed, so every claim about its behaviour was a claim about test wiring
// only. This file fails if that state ever returns — either because the
// composition stops mounting the handler, or because the composition module
// disappears.
//
// It also guards the V1 PRODUCT BOUNDARY: this surface is not mounted in V1.
// That is a decision, and a decision that lives only in a commit message stops
// being readable within a week. The header must state it, and this file fails
// if the statement is removed or quietly softened back into a TODO.

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

/**
 * The composition's leading block comment, in full.
 *
 * This used to be `source.slice(0, 4000)`. A character budget is not a
 * definition of "the header": adding a paragraph could push a required
 * sentence past the cut and turn a documentation edit into a mystery test
 * failure, and the reverse — a claim surviving because it slid below the cut —
 * is worse. The block comment has an exact end, so use it.
 */
function compositionHeader(): string {
  const source = readFileSync(path.join(REPO_ROOT, COMPOSITION), "utf8");
  const end = source.indexOf("*/");
  return end === -1 ? "" : source.slice(0, end + 2);
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

  // Being mounted and being SERVED are two different facts, and the header
  // used to assert the second one while only the first was true ("is what a
  // deployment runner starts"). A reader auditing whether the Access Gateway
  // is actually served would have been told yes. The surface no longer owns a
  // socket at all — the host that binds the one listener lives in the overlay
  // repository, which this repository cannot see — so the honest in-repo claim
  // is that NOTHING HERE binds it. This test makes the header answerable to
  // the tree in BOTH directions, so neither the false claim nor a stale denial
  // can survive.
  it("the header's host claim matches whether an in-repo host exists", () => {
    const hosts: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const file of walk(path.join(REPO_ROOT, root))) {
        const relative = path.relative(REPO_ROOT, file);
        if (relative === COMPOSITION) continue;
        if (
          readFileSync(file, "utf8").includes("createCaioAccessGatewayMount(")
        ) {
          hosts.push(relative);
        }
      }
    }
    const header = compositionHeader();
    const deniesHost = header.includes(
      "NO MODULE IN THIS REPOSITORY BINDS A SOCKET FOR THIS SURFACE",
    );
    if (hosts.length === 0) {
      expect(
        deniesHost,
        "no module here mounts this surface, so the header must say so explicitly",
      ).toBe(true);
      // The specific false sentence must never come back AS AN ASSERTION.
      // Quoted spans are stripped first: the header quotes the retired claim
      // in order to explain why it was wrong, and a naive match cannot tell a
      // statement from a citation of one. (It caught exactly that on the
      // commit that introduced this test.)
      const withoutQuotations = header.replace(/"[^"]*"/g, '""');
      expect(withoutQuotations).not.toMatch(
        /is what a deployment runner starts/,
      );
    } else {
      expect(
        deniesHost,
        `these modules now mount this surface, so the header's denial is stale: ${hosts.join(", ")}`,
      ).toBe(false);
    }
  });

  // The V1 decision, asserted against the file a reader actually opens.
  //
  // Before this, the only thing in the tree that said "not served" said it as
  // The header used to lead with a mechanism ("the ports are unwired"), which
  // reads as a task somebody forgot. After the owner reversed the decision on
  // 2026-08-03 the shape of the claim changed but the requirement did not: the
  // header must state WHAT IS SERVED and WHAT IS NOT, and why the gap that
  // remains is a boundary rather than an unfinished chore.
  it("the header declares what V1 mounts and what it still does not", () => {
    const header = compositionHeader();

    // CONTROL: the header really was read. Without this every toContain below
    // would also pass against a header this function failed to locate — and an
    // empty string trivially satisfies nothing, so assert a sentence that has
    // been in this file since before either decision.
    expect(header.length).toBeGreaterThan(1000);
    expect(header).toContain("ONE SOCKET, ONE HANDLER");

    // THE DECISION, and its date, so the reversal is readable rather than
    // inferred from a diff.
    expect(header).toContain("V1 PRODUCT BOUNDARY");
    expect(header).toContain("IS MOUNTED IN V1");
    expect(header).toContain("2026-08-03");

    // WHAT IS NOT SERVED. /mcp has no dispatcher, and the header must say so
    // rather than leave a reader to discover it from the port type.
    expect(header).toContain("/mcp");
    expect(header).toContain("OPTIONAL");
    expect(header).toContain("404");

    // The ports, named one by one so nobody has to go and count them. The list
    // is the same; what changed is that five of them now exist.
    for (const port of [
      "token authenticator",
      "project resolver",
      "MCP dispatcher",
      "model alias bindings",
      "canonical audit gate",
      "readiness probe",
    ]) {
      expect(header, `the header must name the ${port} port`).toContain(port);
    }

    // The way back for the part that is still out, in one place.
    expect(header).toContain("RE-ENTRY CONDITIONS");
    expect(header).toContain("ownerAuthorizationRecorded");
    // The reason /mcp cannot simply reuse the WorkBuddy dispatcher must stay
    // stated: it is an authentication boundary, and a later reader who does not
    // see that will read the gap as missing wiring.
    expect(header).toContain("BEARER TOKEN");

    // And why the seam survives either decision.
    expect(header).toContain("createCaioAccessGatewayMount");
  });

  // Reversal guard. Nothing here can observe the overlay host, but this repo
  // CAN observe whether it started claiming the surface is served. A header
  // that says "served", "deployed", or "mounted in production" while no module
  // here binds a socket is exactly the false reading this file exists to stop.
  it("the header never claims this surface is served", () => {
    // Quoted spans are stripped first: the header cites the retired claims in
    // order to explain why they were wrong, and a naive match cannot tell a
    // statement from a citation of one.
    const withoutQuotations = compositionHeader().replace(/"[^"]*"/g, '""');
    for (const claim of [
      /is what a deployment runner starts/,
      /\bserved in V1\b/,
      /\bmounted in production\b/,
      /\bcoming soon\b/i,
    ]) {
      expect(withoutQuotations, `header must not claim: ${claim}`).not.toMatch(
        claim,
      );
    }
    // CONTROL: the stripper must leave the header readable rather than
    // blanking it, otherwise every assertion above passes on an empty string.
    expect(withoutQuotations).toContain("V1 PRODUCT BOUNDARY");
  });

  it("the composition mounts the handler once and binds no socket", () => {
    const source = readFileSync(path.join(REPO_ROOT, COMPOSITION), "utf8");
    // Imported from the protocol core, not re-declared locally.
    expect(source).toMatch(
      /import[\s\S]*createCaioGatewayHandler[\s\S]*from "@\/lib\/caio-access-gateway\/gateway-http-core"/,
    );
    // Mounted exactly once: one handler for the whole surface.
    expect(source.match(/createCaioGatewayHandler\(/g)).toHaveLength(1);
    // And no second listener can be built from here: the deployment binds one
    // approved private address and port, and the host owns it.
    expect(source).not.toMatch(/from "node:https"/);
    expect(source).not.toMatch(/\.listen\(/);
  });

  // CONTROL: the scanner must be able to SEE a caller, otherwise every
  // assertion above would pass on an empty file list. gateway-http-core.ts is
  // excluded by DEFINITION, so a positive control proves the walk reaches
  // real files with real content.
  it("the scanner actually reads the tree it claims to scan", () => {
    const files = SCANNED_ROOTS.flatMap((root) =>
      walk(path.join(REPO_ROOT, root)),
    );
    expect(files.length).toBeGreaterThan(100);
    expect(files.map((file) => path.relative(REPO_ROOT, file))).toContain(
      DEFINITION,
    );
    expect(
      readFileSync(path.join(REPO_ROOT, DEFINITION), "utf8"),
    ).toContain("createCaioGatewayHandler");
  });
});
