import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import { resolveRuntimeHealthAttestation } from "@/lib/production-health/runtime-deployment-identity";

import {
  CAIO_ATTENTION_CAPABILITY_FILE,
  parseCaioAttentionCapabilityFile,
  resolveCaioAttentionNodeId,
  resolveCaioAttentionNodeRole,
} from "./capability";

/**
 * RuntimeNode heartbeat (design v5 §1.5, fallback only): each runtime process upserts its own row every 60 s with its
 * deployment id, close capability and whether reminders are enabled. Resume requires a fresh heartbeat matching the
 * node's readiness proof. Off unless the host provides HELM_RUNTIME_NODE_ID and an artifact-bound deployment id
 * (fail closed: without either there is no heartbeat, so resume stays blocked).
 */
export const CAIO_ATTENTION_HEARTBEAT_INTERVAL_MS = 60_000;

export type CaioAttentionHeartbeat = Readonly<{
  nodeId: string; role: string; deploymentId: string; closeCapabilityVersion: number; remindersEnabled: boolean;
}>;

export function resolveCaioAttentionHeartbeat(env: Readonly<Record<string, string | undefined>>, capabilityFileText: string | null):
  CaioAttentionHeartbeat | null {
  const nodeId = resolveCaioAttentionNodeId(env);
  const role = resolveCaioAttentionNodeRole(env);
  const attestation = resolveRuntimeHealthAttestation(env);
  if (!nodeId || !role || attestation.mode !== "artifact-bound") return null;
  return {
    nodeId,
    role,
    deploymentId: attestation.runtimeDeploymentId,
    closeCapabilityVersion: parseCaioAttentionCapabilityFile(capabilityFileText) ?? 0,
    remindersEnabled: ["true", "1"].includes(env.HELM_CAIO_ATTENTION_REMINDERS_ENABLED?.trim().toLowerCase() ?? ""),
  };
}

/** Upserts this node's own row (generator and web identities hold SIU on RuntimeNode). lastSeenAt is the DB clock. */
export async function recordCaioAttentionHeartbeat(client: Pick<PrismaClient, "$executeRaw">, beat: CaioAttentionHeartbeat) {
  await client.$executeRaw`INSERT INTO CaioAttentionRuntimeNode (id, nodeId, role, deploymentId, closeCapabilityVersion, remindersEnabled, lastSeenAt)
    VALUES (${`rn_${randomBytes(12).toString("hex")}`}, ${beat.nodeId}, ${beat.role}, ${beat.deploymentId}, ${beat.closeCapabilityVersion},
      ${beat.remindersEnabled}, NOW(3))
    ON DUPLICATE KEY UPDATE role = VALUES(role), deploymentId = VALUES(deploymentId),
      closeCapabilityVersion = VALUES(closeCapabilityVersion), remindersEnabled = VALUES(remindersEnabled), lastSeenAt = NOW(3)`;
}

/** Starts the 60 s heartbeat when this host is configured for it; returns a stop function (no-op when off). */
export async function startCaioAttentionHeartbeat(client: Pick<PrismaClient, "$executeRaw">, log: (message: string) => void): Promise<() => void> {
  let text: string | null = null;
  try {
    text = await readFile(path.join(process.cwd(), CAIO_ATTENTION_CAPABILITY_FILE), "utf8");
  } catch {
    text = null;
  }
  const beat = resolveCaioAttentionHeartbeat(process.env, text);
  if (!beat) return () => undefined;
  const tick = () => recordCaioAttentionHeartbeat(client, beat).catch((error: unknown) => {
    log(`caio attention heartbeat failed: ${error instanceof Error ? error.name : "error"}`);
  });
  void tick();
  const timer = setInterval(() => { void tick(); }, CAIO_ATTENTION_HEARTBEAT_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
