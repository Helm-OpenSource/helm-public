import { z } from "zod";

import { collectUnsafeInputErrors } from "@/lib/operating-signal-governance/source-governance";

/**
 * Tenant-registered metric query templates and deterministic detectors for the CAIO quick check.
 * Metric values are finite numbers or null only, so a template cannot carry names, phone numbers,
 * free text or per-person rows. Contracts here are customer-neutral; overlays supply the content.
 */

export const CAIO_ANOMALY_SEVERITIES = ["info", "warning", "critical"] as const;
export type CaioAnomalySeverity = (typeof CAIO_ANOMALY_SEVERITIES)[number];

// Case-insensitive like the harness ref pattern, so camelCase keys reach the unsafe-key guard.
export const CAIO_REF_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,190}$/iu;
const refSchema = z.string().regex(CAIO_REF_PATTERN);

export type CaioMetricValues = Readonly<Record<string, number | null>>;
export type CaioMetricQueryContext = Readonly<{ workspaceId: string; windowStart: Date; windowEnd: Date; now: Date }>;

export type CaioMetricQueryTemplate = Readonly<{
  templateId: string;
  domain: string;
  sourceKey: string;
  run: (ctx: CaioMetricQueryContext) => Promise<unknown>;
}>;

export type CaioMetricObservationView = Readonly<{
  templateId: string;
  domain: string;
  status: "ok" | "unknown";
  values: CaioMetricValues | null;
  denominator: number | null;
  evidenceRef: string | null;
}>;

export type CaioDetectorHit = Readonly<{
  mergeKey: string;
  objectKey: string;
  severity: CaioAnomalySeverity;
  reasonCode: string;
  evidenceTemplateIds: readonly string[];
}>;

export type CaioDetector = Readonly<{
  detectorId: string;
  title: Readonly<{ zh: string; en: string }>;
  requiredTemplateIds: readonly string[];
  evaluate: (input: { observations: ReadonlyMap<string, CaioMetricObservationView>; now: Date }) => readonly unknown[];
}>;

export class CaioOperatingContextContractError extends Error {
  constructor(readonly reasons: string[]) {
    super(`caio_operating_context_contract:${reasons.join(",")}`);
    this.name = "CaioOperatingContextContractError";
  }
}

const finite = z.number().refine(Number.isFinite);
const metricResultSchema = z.object({
  values: z.record(refSchema, finite.nullable()),
  denominator: finite.min(0).nullable(),
}).strict();

export function parseCaioMetricResult(raw: unknown):
  | { ok: true; values: CaioMetricValues; denominator: number | null }
  | { ok: false; errorCode: "metric_result_invalid" | "metric_result_unsafe" } {
  const parsed = metricResultSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorCode: "metric_result_invalid" };
  if (collectUnsafeInputErrors(parsed.data).length > 0) return { ok: false, errorCode: "metric_result_unsafe" };
  return { ok: true, values: parsed.data.values, denominator: parsed.data.denominator };
}

const hitSchema = z.object({
  mergeKey: refSchema,
  objectKey: refSchema,
  severity: z.enum(CAIO_ANOMALY_SEVERITIES),
  reasonCode: refSchema,
  evidenceTemplateIds: z.array(refSchema).min(1).max(20),
}).strict();

export function parseCaioDetectorHit(raw: unknown, requiredTemplateIds: readonly string[]):
  | { ok: true; hit: CaioDetectorHit }
  | { ok: false; errorCode: "detector_hit_invalid" | "detector_evidence_outside_inputs" } {
  const parsed = hitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorCode: "detector_hit_invalid" };
  if (parsed.data.evidenceTemplateIds.some((id) => !requiredTemplateIds.includes(id))) {
    return { ok: false, errorCode: "detector_evidence_outside_inputs" };
  }
  return { ok: true, hit: parsed.data };
}

export function assertCaioOperatingContextPack(pack: {
  templates: readonly CaioMetricQueryTemplate[];
  detectors: readonly CaioDetector[];
}): void {
  const reasons = new Set<string>();
  const templateIds = new Set<string>();
  for (const template of pack.templates) {
    if (!CAIO_REF_PATTERN.test(template.templateId)) reasons.add("template_id_invalid");
    if (!CAIO_REF_PATTERN.test(template.domain)) reasons.add("template_domain_invalid");
    if (!template.sourceKey.trim()) reasons.add("template_source_required");
    if (templateIds.has(template.templateId)) reasons.add("duplicate_template_id");
    templateIds.add(template.templateId);
  }
  const detectorIds = new Set<string>();
  for (const detector of pack.detectors) {
    if (!CAIO_REF_PATTERN.test(detector.detectorId)) reasons.add("detector_id_invalid");
    if (detectorIds.has(detector.detectorId)) reasons.add("duplicate_detector_id");
    detectorIds.add(detector.detectorId);
    if (detector.requiredTemplateIds.length === 0) reasons.add("detector_requires_inputs");
    if (detector.requiredTemplateIds.some((id) => !templateIds.has(id))) reasons.add("detector_unknown_template");
    if (!detector.title.zh.trim() || !detector.title.en.trim()) reasons.add("detector_title_required");
  }
  if (reasons.size > 0) throw new CaioOperatingContextContractError([...reasons].sort());
}
