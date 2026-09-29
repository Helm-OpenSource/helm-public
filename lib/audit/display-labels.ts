/**
 * lib/audit/display-labels.ts
 *
 * Pure (client-safe) helpers that resolve Pack/Overlay-contributed audit
 * display labels for one AuditLog row. Labels are display-only: the stored
 * codes are never rewritten, and a missing label always falls back to the raw
 * code at the call site.
 */

import type {
  AuditDisplayLabel,
  RegisteredAuditDisplayLabels,
} from "@/lib/extensions/registry-types";

export type { AuditDisplayLabel, RegisteredAuditDisplayLabels };

/** Per-row label pairs (zh + en) so the client can pick by its own locale. */
export type AuditLogDisplayLabels = {
  action?: AuditDisplayLabel;
  targetType?: AuditDisplayLabel;
  actor?: AuditDisplayLabel;
  sourcePage?: AuditDisplayLabel;
};

type AuditLogCodes = {
  actionType: string;
  targetType?: string | null;
  actor?: string | null;
  sourcePage?: string | null;
};

function lookup(
  table: Readonly<Record<string, AuditDisplayLabel>>,
  code: string | null | undefined,
): AuditDisplayLabel | undefined {
  const key = code?.trim();
  if (!key || !Object.prototype.hasOwnProperty.call(table, key)) {
    return undefined;
  }
  return table[key];
}

export function resolveAuditLogDisplayLabels(
  log: AuditLogCodes,
  registered: RegisteredAuditDisplayLabels,
): AuditLogDisplayLabels {
  const labels: AuditLogDisplayLabels = {};
  const action = lookup(registered.actionTypes, log.actionType);
  const targetType = lookup(registered.targetTypes, log.targetType);
  const actor = lookup(registered.actors, log.actor);
  const sourcePage = lookup(registered.sourcePages, log.sourcePage);
  if (action) labels.action = action;
  if (targetType) labels.targetType = targetType;
  if (actor) labels.actor = actor;
  if (sourcePage) labels.sourcePage = sourcePage;
  return labels;
}

export function pickAuditDisplayLabel(
  label: AuditDisplayLabel | null | undefined,
  english: boolean,
): string | null {
  if (!label) return null;
  return english ? label.en : label.zh;
}

const ACTOR_TYPE_LABELS: Record<string, AuditDisplayLabel> = {
  USER: { zh: "人工", en: "User" },
  SYSTEM: { zh: "系统", en: "System" },
  AI: { zh: "AI", en: "AI" },
};

/** Core-owned label for the `ActorType` enum; unknown values return null. */
export function formatAuditActorType(
  actorType: string | null | undefined,
  english: boolean,
): string | null {
  if (!actorType) return null;
  return pickAuditDisplayLabel(ACTOR_TYPE_LABELS[actorType], english);
}
