import type {
  TenantResourceReadiness,
  TenantResourceReadinessReason,
  TenantResourceType,
} from "@/lib/tenant-resources/readiness";

export type TenantResourceJudgementFieldKey =
  | "customer_status"
  | "recent_interaction"
  | "owner"
  | "amount_or_stage"
  | "case_status"
  | "next_step_time";

export type TenantResourceFieldMappingGapStatus =
  | "available"
  | "missing"
  | "ambiguous"
  | "stale"
  | "not_applicable";

export type TenantResourceFieldMappingJudgementImpact =
  | "use_for_judgement"
  | "explain_only"
  | "downgrade_to_review"
  | "block_guarded_write_evaluation";

export type TenantResourceFieldMappingGapReason =
  | "available_from_mapped_object"
  | "resource_not_relevant"
  | "resource_freshness_unknown"
  | "connection_or_manifest_missing"
  | "source_object_not_mapped"
  | "mapping_completeness_below_threshold"
  | "mapping_conflict";

export type TenantResourceFieldMappingDetailStatus =
  | "usable_for_judgement"
  | "needs_review"
  | "blocked";

export type TenantResourceFieldMappingGapItem = {
  fieldKey: TenantResourceJudgementFieldKey;
  label: {
    zh: string;
    en: string;
  };
  status: TenantResourceFieldMappingGapStatus;
  reasonCode: TenantResourceFieldMappingGapReason;
  judgementImpact: TenantResourceFieldMappingJudgementImpact;
  sourceObjectTypes: string[];
  mappedObjectTypes: string[];
  missingRequirements: string[];
  primaryGap: TenantResourceReadinessReason | null;
  explanation: string;
  repairHint: string;
};

export type TenantResourceFieldMappingGapReadout = {
  readoutKey: string;
  generatedFromResourceKey: string;
  summaryStatus: "clear" | "has_explainable_gaps" | "downgraded";
  judgementDowngrade: boolean;
  guardedWriteEvaluationBlocked: boolean;
  downgradeReason: string | null;
  criticalFieldKeys: TenantResourceJudgementFieldKey[];
  fields: TenantResourceFieldMappingGapItem[];
  boundaryNotes: string[];
};

type FieldRule = {
  fieldKey: TenantResourceJudgementFieldKey;
  label: TenantResourceFieldMappingGapItem["label"];
  appliesToResourceTypes: TenantResourceType[];
  sourceObjectTypes: string[];
  conflictSensitive: boolean;
  guardedWriteCritical: boolean;
};

const fieldRules: FieldRule[] = [
  {
    fieldKey: "customer_status",
    label: {
      zh: "客户状态",
      en: "Customer status",
    },
    appliesToResourceTypes: ["crm", "vertical_system", "spreadsheet", "tenant_extension"],
    sourceObjectTypes: ["CONTACT", "COMPANY", "ACCOUNT", "CUSTOMER"],
    conflictSensitive: true,
    guardedWriteCritical: true,
  },
  {
    fieldKey: "recent_interaction",
    label: {
      zh: "最近互动",
      en: "Recent interaction",
    },
    appliesToResourceTypes: ["crm", "collaboration", "human_input", "spreadsheet"],
    sourceObjectTypes: ["EMAIL_THREAD", "MEETING", "MEMORY", "CONTACT", "OPPORTUNITY"],
    conflictSensitive: true,
    guardedWriteCritical: false,
  },
  {
    fieldKey: "owner",
    label: {
      zh: "负责人",
      en: "Owner",
    },
    appliesToResourceTypes: ["crm", "vertical_system", "spreadsheet", "tenant_extension"],
    sourceObjectTypes: ["CONTACT", "COMPANY", "ACCOUNT", "OPPORTUNITY", "CASE", "TICKET"],
    conflictSensitive: true,
    guardedWriteCritical: true,
  },
  {
    fieldKey: "amount_or_stage",
    label: {
      zh: "金额 / 阶段",
      en: "Amount / stage",
    },
    appliesToResourceTypes: ["crm", "spreadsheet"],
    sourceObjectTypes: ["OPPORTUNITY", "DEAL"],
    conflictSensitive: true,
    guardedWriteCritical: true,
  },
  {
    fieldKey: "case_status",
    label: {
      zh: "案件状态",
      en: "Case status",
    },
    appliesToResourceTypes: ["vertical_system"],
    sourceObjectTypes: ["CASE", "TICKET", "SUPPORT_TICKET"],
    conflictSensitive: true,
    guardedWriteCritical: true,
  },
  {
    fieldKey: "next_step_time",
    label: {
      zh: "下一步时间",
      en: "Next-step time",
    },
    appliesToResourceTypes: ["crm", "collaboration", "human_input", "spreadsheet"],
    sourceObjectTypes: ["OPPORTUNITY", "TASK", "MEETING", "EMAIL_THREAD"],
    conflictSensitive: true,
    guardedWriteCritical: true,
  },
];

export function buildTenantResourceFieldMappingGap(input: {
  resource: TenantResourceReadiness;
  detailStatus?: TenantResourceFieldMappingDetailStatus;
}): TenantResourceFieldMappingGapReadout {
  const mappedObjectTypes = input.resource.mapping.mappedObjectTypes.map((type) =>
    type.toUpperCase(),
  );
  const fields = fieldRules.map((rule) =>
    buildFieldMappingGapItem({
      rule,
      resource: input.resource,
      detailStatus: input.detailStatus ?? "usable_for_judgement",
      mappedObjectTypes,
    }),
  );
  const criticalFieldKeys = fields
    .filter((field) =>
      ["downgrade_to_review", "block_guarded_write_evaluation"].includes(field.judgementImpact),
    )
    .map((field) => field.fieldKey);
  const judgementDowngrade = fields.some(
    (field) => field.judgementImpact === "downgrade_to_review",
  );
  const guardedWriteEvaluationBlocked = fields.some(
    (field) => field.judgementImpact === "block_guarded_write_evaluation",
  );
  const summaryStatus = judgementDowngrade
    ? "downgraded"
    : fields.some((field) => field.status === "ambiguous" || field.status === "missing")
      ? "has_explainable_gaps"
      : "clear";

  return {
    readoutKey: buildStableKey("tenant_resource_field_mapping_gap", input.resource.resourceKey),
    generatedFromResourceKey: input.resource.resourceKey,
    summaryStatus,
    judgementDowngrade,
    guardedWriteEvaluationBlocked,
    downgradeReason: buildDowngradeReason(fields),
    criticalFieldKeys,
    fields,
    boundaryNotes: [
      "field-level mapping gap is a read-only explanation layer, not a field mapping builder",
      "field gaps may downgrade judgement to review but do not create policy or external write authority",
      "guarded write evaluation must remain blocked until critical fields are available, fresh and unambiguous",
    ],
  };
}

function buildFieldMappingGapItem(input: {
  rule: FieldRule;
  resource: TenantResourceReadiness;
  detailStatus: TenantResourceFieldMappingDetailStatus;
  mappedObjectTypes: string[];
}): TenantResourceFieldMappingGapItem {
  const fieldObjectMapped = input.rule.sourceObjectTypes.some((objectType) =>
    input.mappedObjectTypes.includes(objectType),
  );
  const resourceRelevant =
    input.rule.appliesToResourceTypes.includes(input.resource.resourceType) || fieldObjectMapped;
  const base = {
    fieldKey: input.rule.fieldKey,
    label: input.rule.label,
    sourceObjectTypes: input.rule.sourceObjectTypes,
    mappedObjectTypes: input.mappedObjectTypes,
    missingRequirements: input.resource.mapping.missingRequirements,
    primaryGap: input.resource.readiness.primaryGap,
  };

  if (!resourceRelevant) {
    return withExplanation({
      ...base,
      status: "not_applicable",
      reasonCode: "resource_not_relevant",
      judgementImpact: "explain_only",
    });
  }

  if (input.resource.readiness.primaryGap === "freshness_unknown") {
    return withExplanation({
      ...base,
      status: "stale",
      reasonCode: "resource_freshness_unknown",
      judgementImpact: "downgrade_to_review",
    });
  }

  if (hasConnectionOrManifestGap(input.resource)) {
    return withExplanation({
      ...base,
      status: "missing",
      reasonCode: "connection_or_manifest_missing",
      judgementImpact: "downgrade_to_review",
    });
  }

  if (!fieldObjectMapped) {
    return withExplanation({
      ...base,
      status: "missing",
      reasonCode: "source_object_not_mapped",
      judgementImpact: "downgrade_to_review",
    });
  }

  if (input.resource.mapping.mappingCompleteness < 80) {
    return withExplanation({
      ...base,
      status: "ambiguous",
      reasonCode: "mapping_completeness_below_threshold",
      judgementImpact: "downgrade_to_review",
    });
  }

  if (input.rule.conflictSensitive && input.resource.mapping.conflictCount > 0) {
    return withExplanation({
      ...base,
      status: "ambiguous",
      reasonCode: "mapping_conflict",
      judgementImpact:
        input.detailStatus === "usable_for_judgement" && input.resource.readiness.actionable
          ? "explain_only"
          : "downgrade_to_review",
    });
  }

  return withExplanation({
    ...base,
    status: "available",
    reasonCode: "available_from_mapped_object",
    judgementImpact: "use_for_judgement",
  });
}

function withExplanation(input: Omit<TenantResourceFieldMappingGapItem, "explanation" | "repairHint">) {
  return {
    ...input,
    explanation: buildExplanation(input),
    repairHint: buildRepairHint(input),
  };
}

function buildExplanation(input: Omit<TenantResourceFieldMappingGapItem, "explanation" | "repairHint">) {
  const fieldLabel = input.label.en;
  if (input.status === "available") {
    return `${fieldLabel} is available from mapped objects ${input.sourceObjectTypes.join("/")}.`;
  }
  if (input.status === "not_applicable") {
    return `${fieldLabel} is not required for this resource judgement.`;
  }
  if (input.status === "stale") {
    return `${fieldLabel} is stale because the resource freshness is unknown.`;
  }
  if (input.reasonCode === "connection_or_manifest_missing") {
    return `${fieldLabel} is missing because the resource connection, manifest or processing prerequisite is not complete.`;
  }
  if (input.reasonCode === "source_object_not_mapped") {
    return `${fieldLabel} is missing because none of ${input.sourceObjectTypes.join("/")} is mapped.`;
  }
  if (input.reasonCode === "mapping_completeness_below_threshold") {
    return `${fieldLabel} is ambiguous because the mapping completeness is below the review threshold.`;
  }
  return `${fieldLabel} is ambiguous because the mapped field has unresolved conflicts.`;
}

function buildRepairHint(input: Omit<TenantResourceFieldMappingGapItem, "explanation" | "repairHint">) {
  if (input.status === "available") {
    return "Keep the field visible in evidence detail and attach it to judgement reasoning.";
  }
  if (input.status === "not_applicable") {
    return "No repair is required for this resource type.";
  }
  if (input.status === "stale") {
    return "Refresh the resource before using this field in current judgement.";
  }
  if (input.reasonCode === "connection_or_manifest_missing") {
    return "Repair the connection, manifest declaration or processing prerequisite first.";
  }
  if (input.reasonCode === "source_object_not_mapped") {
    return `Map one of ${input.sourceObjectTypes.join("/")} before relying on this judgement field.`;
  }
  if (input.reasonCode === "mapping_completeness_below_threshold") {
    return "Complete field mapping review before upgrading this suggestion out of review.";
  }
  return "Resolve mapping conflicts or keep the suggestion downgraded to review.";
}

function buildDowngradeReason(fields: TenantResourceFieldMappingGapItem[]) {
  const criticalFields = fields.filter((field) => field.judgementImpact === "downgrade_to_review");
  if (criticalFields.length === 0) return null;

  return `Downgrade to review because ${criticalFields
    .map((field) => `${field.label.en}:${field.reasonCode}`)
    .join(", ")}.`;
}

function hasConnectionOrManifestGap(resource: TenantResourceReadiness) {
  if (!resource.connection.readCapability) return true;

  return resource.mapping.missingRequirements.some((requirement) =>
    [
      "connection",
      "extension_manifest",
      "resource_dependency",
      "capability_declaration",
      "processing_completion",
    ].includes(requirement),
  );
}

function buildStableKey(prefix: string, seed: string) {
  const normalized =
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "unknown";

  return `${prefix}_${normalized}`;
}
