// Guard for the Preflight workflow's own time budget.
//
// WHY THIS EXISTS
// Preflight is a required PR check, so when it hits `timeout-minutes` the PR is
// reported as FAILING for a reason that has nothing to do with the change. On
// 2026-07-30 the job ran 7m45s (lint:strict 4m42s + typecheck 58s + boundary
// 1m07s + the three small guards) against a limit of 8 minutes — 15 seconds of
// headroom, i.e. one slow `npm ci` away from a red check on a clean branch.
//
// The fix is a budget with real headroom, and this guard is what keeps the
// budget from silently drifting back under the measured runtime.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PREFLIGHT_WORKFLOW = ".github/workflows/preflight.yml";

/**
 * Longest observed Preflight run, in minutes (2026-07-30, run 30542171638).
 * The limit must clear this with room for a slow runner, not sit on top of it.
 */
const OBSERVED_RUNTIME_MINUTES = 8;
const REQUIRED_HEADROOM_FACTOR = 2;
const MINIMUM_TIMEOUT_MINUTES =
  OBSERVED_RUNTIME_MINUTES * REQUIRED_HEADROOM_FACTOR;

function readWorkflow(): string {
  return readFileSync(resolve(process.cwd(), PREFLIGHT_WORKFLOW), "utf8");
}

/** Every `timeout-minutes:` declared in the workflow, in file order. */
function declaredTimeouts(source: string): number[] {
  return [...source.matchAll(/^\s*timeout-minutes:\s*(\d+)\s*$/gmu)].map(
    (match) => Number.parseInt(match[1] as string, 10),
  );
}

describe("preflight workflow time budget", () => {
  it("declares a timeout on every job", () => {
    const source = readWorkflow();
    const jobCount = [...source.matchAll(/^ {4}runs-on:/gmu)].length;
    expect(jobCount).toBeGreaterThan(0);
    expect(declaredTimeouts(source)).toHaveLength(jobCount);
  });

  it("keeps real headroom over the measured runtime", () => {
    for (const timeout of declaredTimeouts(readWorkflow())) {
      expect(
        timeout,
        `Preflight ran ${OBSERVED_RUNTIME_MINUTES} minutes on 2026-07-30; a limit at or near that turns a slow runner into a failed required check`,
      ).toBeGreaterThanOrEqual(MINIMUM_TIMEOUT_MINUTES);
    }
  });

  it("does not advertise a runtime goal the job does not meet", () => {
    // The header used to promise "< 3 min feedback on every PR push" while the
    // job took 7m45s. A stale promise in a required check is how the timeout
    // got set too low in the first place.
    const source = readWorkflow();
    expect(source).not.toMatch(/<\s*3\s*min/u);
  });
});
