#!/usr/bin/env tsx
/** Prints the CAIO goal ledger least-privilege fixture GRANTs for an isolated test database (see the fixture module). */
import { renderCaioGoalLedgerGrantSql } from "@/lib/caio-goal-ledger/least-privilege-fixture";

const [database, host] = process.argv.slice(2);
if (!database?.startsWith("helm_caio_goal_ledger_")) {
  console.error("usage: caio-goal-ledger-grant-fixture.ts <helm_caio_goal_ledger_* database> [host]");
  process.exit(2);
}
process.stdout.write(renderCaioGoalLedgerGrantSql(database, host ?? "%"));
