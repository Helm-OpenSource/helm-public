import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  checkModelEgressGovernance,
  checkModelEgressMysqlCiWiring,
  scanModelEgressDirectWrites,
} from "./check-model-egress-governance";

function withFixture(
  files: Record<string, string>,
  assertion: (root: string) => void,
): void {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "model-egress-guard-"),
  );
  try {
    for (const [relative, content] of Object.entries(files)) {
      const absolute = path.join(root, relative);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
    }
    assertion(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("model egress governance boundary guard", () => {
  it("passes on the real repository", () => {
    expect(checkModelEgressGovernance(process.cwd())).toEqual([]);
  });

  it("rejects holding or invoking a governed provider adapter outside the gateway", () => {
    // the reviewer bypass: import a concrete adapter and call invoke()
    // directly with fabricated claim hashes -- no decision, no claim, no
    // receipt. Referencing the adapter type outside the registry/gateway
    // is refused outright.
    withFixture(
      {
        "lib/rogue/direct-egress.ts": [
          'import type { GovernedModelProviderAdapter } from "@/lib/llm/governed-model-adapter-registry.service";',
          "export async function leak(adapter: GovernedModelProviderAdapter) {",
          '  return adapter.invoke({ dispatchClaimHash: "sha256:0" } as never);',
          "}",
        ].join("\n"),
      },
      (root) => {
        const rules = scanModelEgressDirectWrites(root).map(
          (violation) => violation.rule,
        );
        expect(rules).toContain("MEG-GATEWAY-BYPASS");
      },
    );
  });

  it("rejects receipt mutation and raw decision deletion", () => {
    withFixture(
      {
        "features/unsafe/actions.ts": [
          "await db.modelEgressReceipt.update({ where: { id }, data });",
          "await db.$executeRawUnsafe('DELETE FROM ModelRouteDecision');",
        ].join("\n"),
      },
      (root) => {
        const rules = scanModelEgressDirectWrites(root).map(
          (violation) => violation.rule,
        );
        expect(rules).toContain("MEG-RECEIPT-APPEND-ONLY");
        expect(rules).toContain("MEG-RAW-MUTATION");
      },
    );
  });

  it("rejects direct creates, createMany and raw inserts", () => {
    withFixture(
      {
        "features/unsafe/creates.ts": [
          "await db.modelEgressReceipt.create({ data });",
          "await db.modelRouteDecision.createMany({ data });",
          "await db.$executeRaw`INSERT INTO ModelEgressReceipt (id) VALUES (${id})`;",
        ].join("\n"),
      },
      (root) => {
        const rules = scanModelEgressDirectWrites(root).map(
          (violation) => violation.rule,
        );
        expect(rules).toEqual(
          expect.arrayContaining([
            "MEG-RECEIPT-APPEND-ONLY",
            "MEG-DECISION-IMMUTABLE",
            "MEG-RAW-MUTATION",
          ]),
        );
      },
    );
  });

  it("rejects decision mutation outside the governed claim store", () => {
    withFixture(
      {
        "lib/unsafe.ts":
          "await tx['modelRouteDecision']['updateMany']({ where, data });",
      },
      (root) => {
        expect(scanModelEgressDirectWrites(root)).toEqual([
          expect.objectContaining({
            rule: "MEG-DECISION-IMMUTABLE",
            file: "lib/unsafe.ts",
          }),
        ]);
      },
    );
  });

  it("allows only the conditional claim mutation in the governed store", () => {
    withFixture(
      {
        "lib/llm/model-egress-store.service.ts":
          "await tx.modelRouteDecision.updateMany({ where, data });",
      },
      (root) => {
        expect(scanModelEgressDirectWrites(root)).toEqual([]);
      },
    );
  });

  it("allows only the exact append operations in the governed store", () => {
    withFixture(
      {
        "lib/llm/model-egress-store.service.ts": [
          "await tx.modelRouteDecision.create({ data });",
          "await tx.modelEgressReceipt.create({ data });",
          "await tx.modelRouteDecision.updateMany({ where, data });",
        ].join("\n"),
      },
      (root) => {
        expect(scanModelEgressDirectWrites(root)).toEqual([]);
      },
    );
  });

  it("rejects direct gateway authority calls from a production feature", () => {
    withFixture(
      {
        "features/workbuddy/actions.ts": [
          "import { GOVERNED_GATEWAY_AUTHORITY, claimModelRouteDispatch } from '@/lib/llm/model-egress-store.service';",
          "export const run = () => claimModelRouteDispatch({ authority: GOVERNED_GATEWAY_AUTHORITY });",
        ].join("\n"),
      },
      (root) => {
        const violations = scanModelEgressDirectWrites(root);
        expect(
          violations.filter(
            (violation) =>
              violation.rule === "MEG-GATEWAY-BYPASS",
          ),
        ).toHaveLength(4);
      },
    );
  });

  it("requires an isolated fail-closed MySQL CI job", () => {
    withFixture(
      {
        "package.json": JSON.stringify({
          scripts: {
            "test:model-egress:mysql":
              "vitest run lib/llm/model-egress-store.mysql.test.ts",
          },
        }),
        ".github/workflows/ci.yml": [
          "jobs:",
          "  build:",
          "    needs: [model-egress-mysql]",
          "  test:",
          "    needs: [model-egress-mysql]",
          "  model-egress-mysql:",
          "    services:",
          "      mysql:",
          "        image: mysql:8.4",
          "    env:",
          "      MODEL_EGRESS_STORE_TEST_DATABASE_NAME: helm_caio_p1d_ci",
          "    steps:",
          "      - run: |",
          "          printf 'DATABASE_URL=%s\\n' \"${url}\" >>\"${GITHUB_ENV}\"",
          "          printf 'MODEL_EGRESS_STORE_DATABASE_URL=%s\\n' \"${url}\" >>\"${GITHUB_ENV}\"",
          "      - run: npx tsx prisma/setup-db.ts prepare",
          "      - run: npm run test:model-egress:mysql",
        ].join("\n"),
      },
      (root) => {
        expect(checkModelEgressMysqlCiWiring(root)).toEqual([]);
      },
    );
  });

  it("rejects a skippable or incomplete MySQL CI job", () => {
    withFixture(
      {
        "package.json": JSON.stringify({ scripts: {} }),
        ".github/workflows/ci.yml": [
          "jobs:",
          "  model-egress-mysql:",
          "    continue-on-error: true",
          "    steps:",
          "      - run: npm test",
        ].join("\n"),
      },
      (root) => {
        const violations = checkModelEgressMysqlCiWiring(root);
        expect(
          violations.filter(
            (violation) => violation.rule === "MEG-MYSQL-CI",
          ).length,
        ).toBeGreaterThanOrEqual(8);
        expect(
          violations.map((violation) => violation.detail),
        ).toContain("model-egress-mysql must be fail-closed");
      },
    );
  });
});
