import { randomUUID } from "node:crypto";

import { AuthCodeChannel, AuthCodePurpose } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";

/**
 * One-time verification codes are claimed with a compare-and-swap. This suite
 * runs that claim against a real MySQL server under genuine concurrency.
 *
 * WHAT THIS PROVES: that the single-statement form used by
 * `features/auth/actions.ts` admits exactly ONE winner when many callers race
 * for the same code — the row lock serialises them and the pre-state lives in
 * the UPDATE's own WHERE, so the affected-row count is a real CAS result.
 *
 * WHAT THIS DOES NOT PROVE: that a regression would be caught here. Reverting
 * to a conditional `updateMany` reintroduces a RACE, and a race does not fail
 * on every run — asserting on it would make CI intermittently red, which is
 * worse than not asserting. The deterministic guard against that regression is
 * the static check `scripts/check-conditional-update-cas.ts`, which fails the
 * build on the shape rather than on the symptom. The two are complementary:
 * the guard pins the call site, this suite shows the shape it pins is actually
 * safe on the engine we ship against.
 *
 * The environment variables are the CAIO gateway's on purpose: this reuses the
 * existing isolated-database job rather than provisioning a second MySQL
 * service, and inherits its `helm_caio_gw_` prefix assertion so the suite can
 * never point at a default or shared database.
 */
const integrationDatabaseUrl = process.env.CAIO_ACCESS_GATEWAY_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_ACCESS_GATEWAY_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const ISOLATED_DATABASE_PREFIX = "helm_caio_gw_";
const CONCURRENT_CLAIMS = 8;
const ATTEMPT_CEILING = 5;

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_ACCESS_GATEWAY_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_ACCESS_GATEWAY_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    databaseName !== confirmedIntegrationDatabaseName ||
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX)
  ) {
    throw new Error(
      "Refusing auth verification code integration test: confirm the isolated database name and use the helm_caio_gw_ prefix.",
    );
  }
}

async function seedCode(input: {
  consumedAt: Date | null;
  attempts: number;
}): Promise<string> {
  const id = `authcode-cas-${randomUUID()}`;
  await db.authVerificationCode.create({
    data: {
      id,
      purpose: AuthCodePurpose.SIGNUP_EMAIL,
      channel: AuthCodeChannel.EMAIL,
      // Synthetic, non-routable target: this suite never sends anything.
      target: `${id}@example.invalid`,
      codeHash: `hash-${id}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: input.consumedAt,
      attempts: input.attempts,
    },
  });
  return id;
}

describeMysql("one-time auth code claims against an isolated MySQL", () => {
  const seededIds: string[] = [];

  beforeAll(() => {
    assertIsolatedDatabaseTarget();
  });

  afterAll(async () => {
    if (seededIds.length > 0) {
      await db.authVerificationCode.deleteMany({
        where: { id: { in: seededIds } },
      });
    }
    await db.$disconnect();
  });

  it("admits exactly one winner when many callers consume the same code", async () => {
    const id = await seedCode({ consumedAt: null, attempts: 0 });
    seededIds.push(id);

    const results = await Promise.all(
      Array.from(
        { length: CONCURRENT_CLAIMS },
        () => db.$executeRaw`
          UPDATE \`AuthVerificationCode\`
             SET \`consumedAt\` = UTC_TIMESTAMP(3)
           WHERE \`id\` = ${id}
             AND \`consumedAt\` IS NULL
        `,
      ),
    );

    const winners = results.filter((affected) => affected === 1);
    expect(winners).toHaveLength(1);
    expect(results.filter((affected) => affected === 0)).toHaveLength(
      CONCURRENT_CLAIMS - 1,
    );

    const row = await db.authVerificationCode.findUnique({
      where: { id },
      select: { consumedAt: true },
    });
    expect(row?.consumedAt).toBeInstanceOf(Date);
  });

  it("never lets concurrent attempts cross the ceiling", async () => {
    // One attempt left before the ceiling: every caller sees `attempts < MAX`
    // at read time, so a read-then-write claim would let all of them through.
    const id = await seedCode({
      consumedAt: null,
      attempts: ATTEMPT_CEILING - 1,
    });
    seededIds.push(id);

    const results = await Promise.all(
      Array.from(
        { length: CONCURRENT_CLAIMS },
        () => db.$executeRaw`
          UPDATE \`AuthVerificationCode\`
             SET \`attempts\` = \`attempts\` + 1
           WHERE \`id\` = ${id}
             AND \`consumedAt\` IS NULL
             AND \`attempts\` < ${ATTEMPT_CEILING}
        `,
      ),
    );

    expect(results.filter((affected) => affected === 1)).toHaveLength(1);

    const row = await db.authVerificationCode.findUnique({
      where: { id },
      select: { attempts: true },
    });
    // The ceiling is the point: the counter must land ON it, never past it.
    expect(row?.attempts).toBe(ATTEMPT_CEILING);
  });

  it("refuses to claim a code that was already consumed", async () => {
    const id = await seedCode({ consumedAt: new Date(), attempts: 0 });
    seededIds.push(id);

    const affected = await db.$executeRaw`
      UPDATE \`AuthVerificationCode\`
         SET \`consumedAt\` = UTC_TIMESTAMP(3)
       WHERE \`id\` = ${id}
         AND \`consumedAt\` IS NULL
    `;

    expect(affected).toBe(0);
  });
});
