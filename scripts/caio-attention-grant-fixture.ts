#!/usr/bin/env tsx
/** Prints the CAIO attention least-privilege fixture GRANTs for an isolated test database (see the fixture module). */
import { renderCaioAttentionGrantSql } from "@/lib/caio-attention/least-privilege-fixture";
import { CAIO_ATTENTION_EVIDENCE_GRANTS } from "@/lib/caio-attention-runtime/evidence-resolver";

const [database, host] = process.argv.slice(2);
if (!database?.startsWith("helm_caio_attention_")) {
  console.error("usage: caio-attention-grant-fixture.ts <helm_caio_attention_* database> [host]");
  process.exit(2);
}
process.stdout.write(renderCaioAttentionGrantSql(database, host ?? "%", CAIO_ATTENTION_EVIDENCE_GRANTS));
