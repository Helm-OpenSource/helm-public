import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  copiesWholeContext,
  DOCKERFILE_PATH,
  findCoverageGaps,
  readTriggerArms,
  WORKFLOW_PATH,
} from "./check-docker-smoke-coverage";

const workflow = (): string => readFileSync(WORKFLOW_PATH, "utf8");
const dockerfile = (): string => readFileSync(DOCKERFILE_PATH, "utf8");

describe("docker smoke coverage guard", () => {
  it("reports no gap for the workflow as it stands", () => {
    expect(findCoverageGaps(workflow(), dockerfile())).toEqual([]);
  });

  it("still applies: the Dockerfile copies the whole build context", () => {
    // CONTROL for the premise. If this stops holding, the assertion above turns
    // into "the guard skipped the path-filter check" while still reading green,
    // so the premise is asserted on its own rather than left implied.
    expect(copiesWholeContext(dockerfile())).toBe(true);
  });

  it("parses both arms of the real workflow", () => {
    // CONTROL for the parser. "no gaps found" and "no arms parsed" print the
    // same result, and only one of them is evidence.
    const arms = readTriggerArms(workflow()).map((arm) => arm.name);
    expect(arms).toContain("pull_request");
    expect(arms).toContain("push");
  });

  it("the push arm covers main", () => {
    const push = readTriggerArms(workflow()).find((arm) => arm.name === "push");
    expect(push).toBeDefined();
    // An arm with no `branches:` covers every branch, which also satisfies this.
    expect(
      push!.branches.length === 0 || push!.branches.includes("main"),
    ).toBe(true);
  });

  describe("the defects it was written for", () => {
    it("flags a workflow with no push arm", () => {
      const gaps = findCoverageGaps(
        "on:\n  pull_request:\n    branches: [main]\n\njobs:\n",
        "COPY . .\n",
      );
      expect(gaps).toEqual([
        "no `push:` arm, so the merged result on main is never smoke-tested",
      ]);
    });

    it("flags a path filter on either arm", () => {
      const gaps = findCoverageGaps(
        [
          "on:",
          "  pull_request:",
          "    paths:",
          '      - "Dockerfile"',
          "  push:",
          "    branches: [main]",
          "    paths:",
          '      - "Dockerfile"',
          "",
          "jobs:",
        ].join("\n"),
        "COPY . .\n",
      );
      expect(gaps).toHaveLength(2);
      expect(gaps[0]).toContain("`pull_request:` arm narrows itself by path");
      expect(gaps[1]).toContain("`push:` arm narrows itself by path");
    });

    it("flags paths-ignore too, not only paths", () => {
      const gaps = findCoverageGaps(
        [
          "on:",
          "  push:",
          "    branches: [main]",
          "    paths-ignore:",
          '      - "docs/**"',
          "",
          "jobs:",
        ].join("\n"),
        "COPY . .\n",
      );
      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toContain("narrows itself by path");
    });

    it("flags a push arm that names branches but not main", () => {
      const gaps = findCoverageGaps(
        "on:\n  push:\n    branches: [develop]\n\njobs:\n",
        "COPY . .\n",
      );
      expect(gaps).toEqual([
        "the `push:` arm names develop but not main",
      ]);
    });
  });

  describe("it stops demanding a shape once the reason for it is gone", () => {
    it("says the reasoning no longer applies when the context copy is dropped", () => {
      const gaps = findCoverageGaps(
        "on:\n  push:\n    branches: [main]\n    paths:\n      - \"Dockerfile\"\n\njobs:\n",
        "COPY prisma ./prisma\nCOPY --from=build /app/lib ./lib\n",
      );
      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toContain("no longer copies the whole build context");
      // The path-filter complaint is deliberately NOT raised: a narrowed
      // Dockerfile can support a narrowed filter, and that is a decision to
      // make with the new copy set in hand, not one to force from here.
      expect(gaps[0]).not.toContain("narrows itself by path");
    });

    it("does not mistake a stage copy for a whole-context copy", () => {
      expect(copiesWholeContext("COPY --from=build . .\n")).toBe(false);
      expect(copiesWholeContext("COPY . ./app\n")).toBe(false);
      expect(copiesWholeContext("COPY . .\n")).toBe(true);
    });
  });

  describe("fail-closed", () => {
    it("throws instead of passing when the on: block is missing", () => {
      expect(() => readTriggerArms("jobs:\n  build:\n")).toThrow(
        /no top-level `on:` block/u,
      );
    });

    it("throws instead of passing when no arm parses", () => {
      expect(() => readTriggerArms("on:\njobs:\n")).toThrow(
        /found no trigger arms/u,
      );
    });
  });
});
