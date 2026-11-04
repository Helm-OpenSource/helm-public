import { createHash, randomBytes } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { parseCaioAttentionRouteConfig } from "./contracts";
import { appendCaioAttentionControlEvent } from "./control-event.service";
import { CAIO_ATTENTION_CONTROL_TX, CaioAttentionControlRefusal } from "./control.service";

/**
 * Versioned people bindings (design v4 §2 tables 5–6, operator identity): publish appends a validated version
 * (version = max + 1, append-only by grants), activate moves the per-workspace head by one atomic compare-and-swap
 * on rowVersion. createdByRef / updatedByRef carry the operator; the generator reads the active version. Each
 * publish / activate appends a CaioAttentionControlEvent in the same transaction (no epochs: workspace-scoped).
 */
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,191}$/u;
const ACTOR_REF_PATTERN = /^[a-z][a-z0-9_]{0,31}:[A-Za-z0-9][A-Za-z0-9._@:-]{0,127}$/u;

function requireText(value: unknown, pattern: RegExp, code: string): string {
  if (typeof value === "string" && pattern.test(value)) return value;
  throw new CaioAttentionControlRefusal(code);
}

const isDuplicate = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError
  && (error.code === "P2002" || String((error.meta as { code?: unknown } | undefined)?.code) === "1062");

export async function publishCaioAttentionRouteConfig(client: PrismaClient, input: Readonly<{ workspaceId: unknown; actorRef: unknown; config: unknown }>) {
  const workspaceId = requireText(input.workspaceId, WORKSPACE_ID_PATTERN, "workspace_id_invalid");
  const actor = requireText(input.actorRef, ACTOR_REF_PATTERN, "actor_ref_invalid");
  if (!parseCaioAttentionRouteConfig(input.config).ok) throw new CaioAttentionControlRefusal("route_config_invalid");
  const configJson = JSON.stringify(input.config);
  const contentHash = createHash("sha256").update(configJson).digest("hex");
  const schemaVersion = (input.config as { schemaVersion: string }).schemaVersion;
  try {
    return await client.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ v: number | null }>>`
        SELECT MAX(version) AS v FROM CaioAttentionRouteConfig WHERE workspaceId = ${workspaceId}`;
      const version = Number(row?.v ?? 0) + 1;
      await tx.$executeRaw`INSERT INTO CaioAttentionRouteConfig (id, workspaceId, version, schemaVersion, configJson, contentHash, createdByRef)
        VALUES (${`rc_${randomBytes(12).toString("hex")}`}, ${workspaceId}, ${version}, ${schemaVersion}, ${configJson}, ${contentHash}, ${actor})`;
      await appendCaioAttentionControlEvent(tx, { op: "routes-publish", actorRef: actor, epoch: null, openEpoch: null,
        payload: { workspaceId, version, schemaVersion, contentHash } });
      return { workspaceId, version, contentHash };
    }, CAIO_ATTENTION_CONTROL_TX);
  } catch (error) {
    if (isDuplicate(error)) throw new CaioAttentionControlRefusal("version_conflict");
    throw error;
  }
}

export async function activateCaioAttentionRouteConfig(
  client: PrismaClient,
  input: Readonly<{ workspaceId: unknown; actorRef: unknown; version: unknown; expectedRowVersion: unknown }>,
) {
  const workspaceId = requireText(input.workspaceId, WORKSPACE_ID_PATTERN, "workspace_id_invalid");
  const actor = requireText(input.actorRef, ACTOR_REF_PATTERN, "actor_ref_invalid");
  const { version, expectedRowVersion } = input;
  if (!Number.isInteger(version) || !Number.isInteger(expectedRowVersion) || (version as number) < 1 || (expectedRowVersion as number) < 0) {
    throw new CaioAttentionControlRefusal("version_invalid");
  }
  const [exists] = await client.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM CaioAttentionRouteConfig WHERE workspaceId = ${workspaceId} AND version = ${version}`;
  if (!exists) throw new CaioAttentionControlRefusal("version_missing");
  const activated = (tx: Prisma.TransactionClient, rowVersion: number) => appendCaioAttentionControlEvent(tx, {
    op: "routes-activate", actorRef: actor, epoch: null, openEpoch: null, payload: { workspaceId, activeVersion: version, rowVersion },
  }).then(() => ({ workspaceId, activeVersion: version as number, rowVersion }));
  if (expectedRowVersion === 0) {
    try {
      // The first head: INSERT and its event in one transaction; a duplicate rolls both back.
      return await client.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO CaioAttentionRouteConfigHead (id, workspaceId, activeVersion, updatedByRef)
          VALUES (${`rh_${randomBytes(12).toString("hex")}`}, ${workspaceId}, ${version}, ${actor})`;
        return activated(tx, 0);
      }, CAIO_ATTENTION_CONTROL_TX);
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      // A head exists: fall through to the compare-and-swap, which refuses because rowVersion 0 is stale or moves it.
    }
  }
  return client.$transaction(async (tx) => {
    const moved = await tx.$executeRaw`UPDATE CaioAttentionRouteConfigHead SET activeVersion = ${version}, rowVersion = rowVersion + 1,
      updatedByRef = ${actor}, updatedAt = NOW(3) WHERE workspaceId = ${workspaceId} AND rowVersion = ${expectedRowVersion}`;
    if (moved !== 1) throw new CaioAttentionControlRefusal("head_conflict");
    return activated(tx, (expectedRowVersion as number) + 1);
  }, CAIO_ATTENTION_CONTROL_TX);
}
