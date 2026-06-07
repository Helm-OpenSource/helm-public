/**
 * Source Profiler — deterministic mapping proposer.
 *
 * Turns a DiscoveredObject's tag profile into SignalMappingCandidate(s) onto
 * Helm internal entities + signal families. Field targets use Helm's External*
 * import vocabulary so a downstream importer could consume an accepted mapping.
 * Output is always `state: "candidate"`, `origin: "deterministic"`.
 */

import type { DiscoveredObject, DiscoveredField } from "../contract/code-scan";
import type { SignalMappingCandidate, FieldMapping } from "../contract/mapping";
import type { SignalFamily, TargetEntity } from "../contract/governance";
import { shortHash } from "../util/hash";

type EntityRule = {
  entity: TargetEntity;
  signalFamily: SignalFamily;
  /** Tags that must all be present for this rule to fire. */
  requiredTags: string[];
  /** Tags that boost confidence when present. */
  boostTags: string[];
  /** If EVERY tag here is present, this rule does NOT fire (mutual exclusion). */
  suppressIfTags?: string[];
  /** Object/table name hint; a match adds confidence. */
  nameHint?: RegExp;
  /** tag -> External* targetField + transform. */
  fieldTargets: Record<string, { targetField: string; transform?: FieldMapping["transform"] }>;
};

const NAME_HINT_BONUS = 10;
const AMBIGUITY_PENALTY = 12;

const ENTITY_RULES: readonly EntityRule[] = [
  {
    entity: "Opportunity",
    signalFamily: "advancement",
    requiredTags: ["amount", "stage"],
    boostTags: ["company_ref", "owner_ref", "name", "due_date"],
    nameHint: /(deal|opportunit|pipeline|商机|机会)/i,
    fieldTargets: {
      amount: { targetField: "amount" },
      stage: { targetField: "stageLabel" },
      name: { targetField: "title", transform: "normalize_name" },
      company_ref: { targetField: "companyExternalIds" },
      owner_ref: { targetField: "ownerExternalId" },
      due_date: { targetField: "dueDate", transform: "parse_date" },
    },
  },
  {
    entity: "Company",
    signalFamily: "advancement",
    requiredTags: ["name", "domain"],
    boostTags: ["owner_ref"],
    nameHint: /(compan|account|organi|客户|公司)/i,
    fieldTargets: {
      name: { targetField: "name", transform: "normalize_name" },
      domain: { targetField: "domain", transform: "normalize_domain" },
      owner_ref: { targetField: "ownerExternalId" },
    },
  },
  {
    entity: "Contact",
    signalFamily: "advancement",
    requiredTags: ["email"],
    boostTags: ["name", "phone", "company_ref", "owner_ref"],
    nameHint: /(contact|person|people|lead|联系人)/i,
    fieldTargets: {
      email: { targetField: "email" },
      name: { targetField: "fullName", transform: "normalize_name" },
      phone: { targetField: "phone" },
      company_ref: { targetField: "companyExternalIds" },
      owner_ref: { targetField: "ownerExternalId" },
    },
  },
  {
    entity: "Meeting",
    signalFamily: "receipt",
    requiredTags: ["date", "name"],
    boostTags: ["contact_ref", "company_ref"],
    // A clear Opportunity (amount+stage) is not a meeting, even if it has dates.
    suppressIfTags: ["amount", "stage"],
    nameHint: /(meeting|event|appointment|calendar|会议|日程)/i,
    fieldTargets: {
      name: { targetField: "title", transform: "normalize_name" },
      date: { targetField: "startsAt", transform: "parse_date" },
      contact_ref: { targetField: "contactExternalIds" },
      company_ref: { targetField: "companyExternalIds" },
    },
  },
  {
    entity: "Task",
    signalFamily: "commitment",
    requiredTags: ["due_date", "name"],
    boostTags: ["owner_ref"],
    // A clear Opportunity (amount+stage) is not a task, even if it has a due date.
    suppressIfTags: ["amount", "stage"],
    nameHint: /(task|todo|action|ticket|工单|任务)/i,
    fieldTargets: {
      name: { targetField: "title", transform: "normalize_name" },
      due_date: { targetField: "dueDate", transform: "parse_date" },
      owner_ref: { targetField: "ownerExternalId" },
    },
  },
];

export function proposeMappings(object: DiscoveredObject): SignalMappingCandidate[] {
  const tagIndex = indexFieldsByTag(object.fields);
  const presentTags = new Set(tagIndex.keys());
  const candidates: SignalMappingCandidate[] = [];

  for (const rule of ENTITY_RULES) {
    if (!rule.requiredTags.every((t) => presentTags.has(t))) continue;
    // Mutual exclusion: a stronger competing signal suppresses this rule.
    if (rule.suppressIfTags && rule.suppressIfTags.every((t) => presentTags.has(t))) continue;

    const fieldMappings: FieldMapping[] = [];
    const usedTags: string[] = [];
    for (const [tag, target] of Object.entries(rule.fieldTargets)) {
      const sourceField = tagIndex.get(tag);
      if (!sourceField) continue;
      usedTags.push(tag);
      fieldMappings.push({
        sourceField,
        targetField: target.targetField,
        transform: target.transform ?? "direct",
        confidence: rule.requiredTags.includes(tag) ? 90 : 70,
      });
    }

    candidates.push({
      id: shortHash(`${object.id}:${rule.entity}`),
      sourceObjectId: object.id,
      targetEntity: rule.entity,
      signalFamily: rule.signalFamily,
      fieldMappings,
      confidence: scoreConfidence(rule, presentTags, object),
      rationale: buildRationale(object, rule, usedTags),
      origin: "deterministic",
      state: "candidate",
      evidenceRefs: [object.id, ...usedTags.map((t) => `${object.id}:tag:${t}`)],
    });
  }

  // Ambiguity penalty: when an object yields multiple candidates, keep the top
  // one and downweight the rest so coincidental matches sort below clear ones.
  if (candidates.length > 1) {
    candidates.sort((a, b) => b.confidence - a.confidence);
    for (let i = 1; i < candidates.length; i++) {
      candidates[i].confidence = Math.max(0, candidates[i].confidence - AMBIGUITY_PENALTY);
    }
  }

  return candidates;
}

function scoreConfidence(rule: EntityRule, presentTags: Set<string>, object: DiscoveredObject): number {
  const boostHits = rule.boostTags.filter((t) => presentTags.has(t)).length;
  // Required tags all present (guaranteed here) → base 70; each boost adds up to 30.
  const boostShare = rule.boostTags.length === 0 ? 0 : (boostHits / rule.boostTags.length) * 30;
  const nameBonus = rule.nameHint && rule.nameHint.test(object.name) ? NAME_HINT_BONUS : 0;
  const raw = Math.round(70 + boostShare + nameBonus);
  // Cap by structural parse confidence: a low-confidence parse caps the mapping.
  return Math.max(0, Math.min(100, Math.min(raw, object.parseConfidence)));
}

function buildRationale(
  object: DiscoveredObject,
  rule: EntityRule,
  usedTags: string[],
): string {
  return (
    `Structure "${object.name}" (${object.kind}) carries ${usedTags.join(", ")} → ` +
    `proposed ${rule.entity} / ${rule.signalFamily}. Deterministic structural match; human review required.`
  );
}

function indexFieldsByTag(fields: readonly DiscoveredField[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const field of fields) {
    for (const tag of field.semanticTags) {
      if (!index.has(tag)) index.set(tag, field.name);
    }
  }
  return index;
}
