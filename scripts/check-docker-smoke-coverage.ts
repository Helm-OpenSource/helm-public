#!/usr/bin/env tsx
/**
 * Docker smoke trigger coverage guard.
 *
 * `d2-docker-smoke.yml` builds the image from the Dockerfile, and the Dockerfile
 * builds the application with a whole-context `COPY . .`. The build therefore
 * depends on every tracked file in the repository — `.dockerignore` excludes
 * only build output, `node_modules`, `.git` and `.env*`, none of which appear in
 * a reviewed diff.
 *
 * A `paths:` filter is a claim that nothing outside the list can change the
 * outcome of the run. Against `COPY . .` that claim is false for any list that
 * is not the whole repository, so the workflow carried no honest filter — it
 * carried a short one. The filter listed `Dockerfile`, `docker-compose.yml`,
 * `package*.json`, `prisma/**` and the smoke script, so a change to `app/`,
 * `lib/` or `components/` that breaks the image build did not run the smoke
 * test that would have caught it. `scripts/fix-local-lightningcss-signature.mjs`
 * is COPY'd by name at Dockerfile line 28 and was not in the list either.
 *
 * The workflow also had no `push:` arm at all, so the merged result on main was
 * never smoke-tested — each pull request was validated against its own base and
 * nothing checked what the merge produced.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD REQUIRES
 * ---------------------------------------------------------------------------
 *
 *   1. The workflow has a `push:` arm that includes `main`.
 *   2. Neither trigger arm carries `paths:` or `paths-ignore:`.
 *
 * Requirement 2 is conditional on the premise, and the premise is checked: if
 * the Dockerfile stops copying the whole context, this guard fails and says the
 * reasoning no longer applies, rather than continuing to demand a shape whose
 * justification has gone. A narrowed Dockerfile could support a narrowed filter,
 * and that is a decision to make deliberately, with the new copy set in hand.
 *
 * FAIL-CLOSED. An unreadable workflow, an unparsable `on:` block, or a missing
 * Dockerfile throws. A coverage guard that passes because it found nothing to
 * look at is worse than no guard, because it is read as evidence.
 *
 * COST, measured rather than assumed. Of the last 40 commits on main, 1 touched
 * a path the old filter listed. Dropping the filter turns roughly 1 run per 40
 * commits into 40, at about 4 minutes each — some 156 minutes of runner time per
 * 40 commits. That is the price of the smoke test actually covering the build it
 * claims to cover. A cheaper filter is available only by narrowing what the
 * Dockerfile copies.
 */

import { readFileSync } from "node:fs";

export const WORKFLOW_PATH = ".github/workflows/d2-docker-smoke.yml";
export const DOCKERFILE_PATH = "Dockerfile";

export interface TriggerArm {
  readonly name: string;
  readonly hasPathFilter: boolean;
  readonly branches: readonly string[];
}

/** True when the Dockerfile copies the whole build context in one directive. */
export function copiesWholeContext(dockerfile: string): boolean {
  return dockerfile
    .split("\n")
    .some((line) => /^COPY\s+(?!--from=)\.\s+\.\s*$/u.test(line.trim()));
}

/**
 * The trigger arms of a workflow's `on:` block, with whether each one narrows
 * itself by path and which branches it names.
 *
 * Throws rather than returning an empty list: "this workflow has no triggers"
 * and "this parser is broken" produce the same value otherwise, and only one of
 * them should be allowed to pass a guard.
 */
export function readTriggerArms(workflow: string): TriggerArm[] {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === "on:");
  if (start === -1) {
    throw new Error(`${WORKFLOW_PATH}: no top-level \`on:\` block`);
  }

  const arms: TriggerArm[] = [];
  let current: { name: string; hasPathFilter: boolean; branches: string[] } | null =
    null;
  let inBranches = false;

  const flush = (): void => {
    if (current) arms.push({ ...current, branches: [...current.branches] });
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!line.startsWith(" ")) break; // a column-0 key ends the block

    const arm = /^ {2}([a-z_]+):\s*$/u.exec(line);
    if (arm) {
      flush();
      current = { name: arm[1], hasPathFilter: false, branches: [] };
      inBranches = false;
      continue;
    }
    if (current === null) continue;

    if (/^ {4}paths(-ignore)?:/u.test(line)) {
      current.hasPathFilter = true;
      inBranches = false;
      continue;
    }

    // `branches: [main, develop]` and the block-list form both appear here.
    const inline = /^ {4}branches:\s*\[([^\]]*)\]\s*$/u.exec(line);
    if (inline) {
      current.branches.push(
        ...inline[1]
          .split(",")
          .map((name) => name.trim().replace(/^["']|["']$/gu, ""))
          .filter(Boolean),
      );
      inBranches = false;
      continue;
    }
    if (/^ {4}branches:\s*$/u.test(line)) {
      inBranches = true;
      continue;
    }
    if (/^ {4}[a-z_-]+:/u.test(line)) {
      inBranches = false;
      continue;
    }
    if (inBranches) {
      const item = /^ {6}- ["']?([^"'\s]+)["']?\s*$/u.exec(line);
      if (item) current.branches.push(item[1]);
    }
  }
  flush();

  if (arms.length === 0) {
    throw new Error(`${WORKFLOW_PATH}: parsed \`on:\` and found no trigger arms`);
  }
  return arms;
}

/** Every reason the smoke workflow does not cover what it claims to cover. */
export function findCoverageGaps(
  workflow: string,
  dockerfile: string,
): string[] {
  const gaps: string[] = [];
  const arms = readTriggerArms(workflow);

  const push = arms.find((arm) => arm.name === "push");
  if (!push) {
    gaps.push(
      "no `push:` arm, so the merged result on main is never smoke-tested",
    );
  } else if (push.branches.length > 0 && !push.branches.includes("main")) {
    gaps.push(
      `the \`push:\` arm names ${push.branches.join(", ")} but not main`,
    );
  }

  if (!copiesWholeContext(dockerfile)) {
    gaps.push(
      "the Dockerfile no longer copies the whole build context, so this guard's" +
        " reasoning about path filters no longer applies — re-derive the filter" +
        " from what the Dockerfile now copies, and update this guard",
    );
    return gaps;
  }

  for (const arm of arms) {
    if (arm.hasPathFilter) {
      gaps.push(
        `the \`${arm.name}:\` arm narrows itself by path, but the Dockerfile` +
          " copies the whole context, so any list shorter than the repository" +
          " is a claim the build contradicts",
      );
    }
  }
  return gaps;
}

export function main(): number {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");
  const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");
  const gaps = findCoverageGaps(workflow, dockerfile);
  if (gaps.length === 0) {
    console.log("docker smoke coverage guard: OK");
    return 0;
  }
  console.error(`${WORKFLOW_PATH} does not cover the build it smoke-tests:`);
  for (const gap of gaps) console.error(`  - ${gap}`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
