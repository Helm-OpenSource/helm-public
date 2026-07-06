import { PrismaClient } from "@prisma/client";

type ForeignKeyConstraintRow = {
  tableName: string;
  constraintName: string;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  return { apply };
}

function quoteMysqlIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new PrismaClient({
    log: ["error", "warn"],
  });

  try {
    const constraints = await db.$queryRawUnsafe<ForeignKeyConstraintRow[]>(`
      SELECT
        TABLE_NAME AS tableName,
        CONSTRAINT_NAME AS constraintName
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      ORDER BY TABLE_NAME ASC, CONSTRAINT_NAME ASC
    `);

    console.log(`[fk-drop] Found ${constraints.length} foreign key constraints in current database.`);
    if (constraints.length === 0) {
      return;
    }

    const statements = constraints.map((item) => {
      const tableName = quoteMysqlIdentifier(item.tableName);
      const constraintName = quoteMysqlIdentifier(item.constraintName);
      return `ALTER TABLE ${tableName} DROP FOREIGN KEY ${constraintName}`;
    });

    if (!args.apply) {
      console.log("[fk-drop] Dry-run mode. Re-run with --apply to execute.");
      for (const statement of statements) {
        console.log(`${statement};`);
      }
      return;
    }

    for (const statement of statements) {
      await db.$executeRawUnsafe(statement);
    }

    console.log(`[fk-drop] Dropped ${statements.length} foreign key constraints.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[fk-drop] failed", message);
  process.exitCode = 1;
});
