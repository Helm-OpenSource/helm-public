import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");

// The deployed gateway composition loads this runtime from a standalone Node
// process (`node --conditions=react-server --import tsx`), not through the
// Next.js bundler. Anything on the static import chain that resolves
// `next/navigation` blows up there with `React.default.createContext is not a
// function` — before the gateway ever binds its listener.
const REACT_SERVER_CONTEXT_FAILURE = /createContext is not a function/;

type ImportProbe = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string;
}>;

function importUnderReactServerCondition(specifier: string): ImportProbe {
  const env = { ...process.env };
  // The gateway composes without any database configuration, and vitest.config
  // injects a shared default DATABASE_URL into this process. Strip it so the
  // probe cannot lean on (or reach for) a shared database.
  delete env.DATABASE_URL;

  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--eval",
      `import(${JSON.stringify(specifier)})` +
        `.then(() => { console.log("IMPORT_OK"); })` +
        `.catch((error) => { console.error("IMPORT_FAIL:", error?.message ?? error); process.exitCode = 1; });`,
    ],
    { cwd: repoRoot, encoding: "utf8", env },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("WorkBuddy gateway runtime under the react-server condition", () => {
  it("imports the production prisma gateway runtime without a react-server context failure", () => {
    const probe = importUnderReactServerCondition(
      "./tools/caio-workbuddy-gateway/prisma-runtime.ts",
    );

    expect(probe.stderr).not.toMatch(REACT_SERVER_CONTEXT_FAILURE);
    expect(probe.status).toBe(0);
    expect(probe.stdout).toContain("IMPORT_OK");
  });

  it("keeps the shared analytics barrel session-free", () => {
    // `@/lib/analytics` is imported by ~50 domain services, several of which the
    // gateway composes. Guarding the barrel itself stops the regression class at
    // its source rather than one transitive consumer at a time.
    const probe = importUnderReactServerCondition("./lib/analytics/index.ts");

    expect(probe.stderr).not.toMatch(REACT_SERVER_CONTEXT_FAILURE);
    expect(probe.status).toBe(0);
    expect(probe.stdout).toContain("IMPORT_OK");
  });

  it("keeps the session-bound module as the react-server hazard this seam must stay clear of", () => {
    // Positive control: proves the probe above is not vacuous. `lib/auth/session`
    // legitimately depends on `next/navigation`, so it cannot be imported outside
    // the Next.js bundler under the react-server condition. If this ever exits 0,
    // the probe has stopped being able to observe the regression it guards.
    const probe = importUnderReactServerCondition("./lib/auth/session.ts");

    expect(probe.status).not.toBe(0);
    expect(probe.stderr).toMatch(REACT_SERVER_CONTEXT_FAILURE);
  });
});
