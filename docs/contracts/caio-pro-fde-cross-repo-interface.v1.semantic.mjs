export const CAIO_PRO_FDE_PORTABLE_SEMANTIC_VERIFIER_REVISION =
  "helm.caio-pro-fde.portable-semantic-verifier.v1";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isPackSemanticGraph(value) {
  return (
    isRecord(value) &&
    Array.isArray(value.taxonomy) &&
    value.taxonomy.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.taxonomyRef === "string" &&
        typeof entry.categoryRef === "string",
    ) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.metricRef === "string" &&
        isStringArray(entry.evidenceRefs),
    ) &&
    Array.isArray(value.evidenceApplicabilityRules) &&
    value.evidenceApplicabilityRules.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.ruleRef === "string" &&
        isStringArray(entry.taxonomyRefs) &&
        isStringArray(entry.acceptedEvidenceKinds),
    ) &&
    Array.isArray(value.candidateInputs) &&
    value.candidateInputs.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.candidateRef === "string" &&
        isStringArray(entry.taxonomyRefs) &&
        isStringArray(entry.metricRefs) &&
        isStringArray(entry.evidenceRefs),
    ) &&
    Array.isArray(value.evidenceBindings) &&
    value.evidenceBindings.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.evidenceRef === "string" &&
        typeof entry.evidenceKind === "string",
    )
  );
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

export function validateCaioProFdePackOperatingInputSemanticRules(value) {
  if (!isPackSemanticGraph(value)) {
    return {
      valid: false,
      errors: ["pack_semantic_graph_structure_invalid"],
    };
  }

  const errors = [];
  const requireUnique = (values, reason) => {
    if (hasDuplicates(values)) errors.push(reason);
  };

  requireUnique(
    value.taxonomy.map((entry) => entry.taxonomyRef),
    "pack_taxonomy_ref_duplicate",
  );
  requireUnique(
    value.taxonomy.map((entry) => entry.categoryRef),
    "pack_category_ref_duplicate",
  );
  requireUnique(
    value.metrics.map((entry) => entry.metricRef),
    "pack_metric_ref_duplicate",
  );
  requireUnique(
    value.evidenceApplicabilityRules.map((entry) => entry.ruleRef),
    "pack_evidence_rule_ref_duplicate",
  );
  requireUnique(
    value.candidateInputs.map((entry) => entry.candidateRef),
    "pack_candidate_input_ref_duplicate",
  );
  requireUnique(
    value.evidenceBindings.map((entry) => entry.evidenceRef),
    "pack_evidence_binding_ref_duplicate",
  );
  for (const rule of value.evidenceApplicabilityRules) {
    requireUnique(rule.taxonomyRefs, "pack_rule_taxonomy_ref_duplicate");
    requireUnique(
      rule.acceptedEvidenceKinds,
      "pack_rule_evidence_kind_duplicate",
    );
  }
  for (const candidate of value.candidateInputs) {
    requireUnique(
      candidate.taxonomyRefs,
      "pack_candidate_taxonomy_ref_duplicate",
    );
    requireUnique(candidate.metricRefs, "pack_candidate_metric_ref_duplicate");
    requireUnique(
      candidate.evidenceRefs,
      "pack_candidate_evidence_ref_duplicate",
    );
  }
  for (const metric of value.metrics) {
    requireUnique(metric.evidenceRefs, "pack_metric_evidence_ref_duplicate");
  }

  const taxonomyRefs = new Set(value.taxonomy.map((entry) => entry.taxonomyRef));
  const metricRefs = new Set(value.metrics.map((entry) => entry.metricRef));
  const evidenceKinds = new Map(
    value.evidenceBindings.map((entry) => [entry.evidenceRef, entry.evidenceKind]),
  );
  const rulesByTaxonomy = new Map();
  for (const rule of value.evidenceApplicabilityRules) {
    for (const taxonomyRef of rule.taxonomyRefs) {
      if (!taxonomyRefs.has(taxonomyRef)) {
        errors.push("pack_rule_taxonomy_ref_dangling");
        continue;
      }
      const rules = rulesByTaxonomy.get(taxonomyRef) ?? [];
      rules.push(rule);
      rulesByTaxonomy.set(taxonomyRef, rules);
    }
  }
  for (const taxonomyRef of taxonomyRefs) {
    if ((rulesByTaxonomy.get(taxonomyRef) ?? []).length === 0) {
      errors.push("pack_taxonomy_rule_coverage_missing");
    }
  }

  const metricByRef = new Map(
    value.metrics.map((entry) => [entry.metricRef, entry]),
  );
  const reachableTaxonomyRefs = new Set(
    value.candidateInputs.flatMap((candidate) => candidate.taxonomyRefs),
  );
  const reachableMetricRefs = new Set(
    value.candidateInputs.flatMap((candidate) => candidate.metricRefs),
  );
  if ([...taxonomyRefs].some((ref) => !reachableTaxonomyRefs.has(ref))) {
    errors.push("pack_taxonomy_candidate_coverage_missing");
  }
  if ([...metricRefs].some((ref) => !reachableMetricRefs.has(ref))) {
    errors.push("pack_metric_candidate_coverage_missing");
  }

  const coveredEvidenceRefs = new Set();
  for (const metric of value.metrics) {
    for (const evidenceRef of metric.evidenceRefs) {
      coveredEvidenceRefs.add(evidenceRef);
    }
    if (metric.evidenceRefs.some((ref) => !evidenceKinds.has(ref))) {
      errors.push("pack_metric_evidence_binding_missing");
    }
  }
  for (const candidate of value.candidateInputs) {
    const candidateTaxonomies = candidate.taxonomyRefs.filter((taxonomyRef) => {
      if (!taxonomyRefs.has(taxonomyRef)) {
        errors.push("pack_candidate_taxonomy_ref_dangling");
        return false;
      }
      return true;
    });
    const candidateMetrics = candidate.metricRefs.flatMap((metricRef) => {
      const metric = metricByRef.get(metricRef);
      if (!metricRefs.has(metricRef) || !metric) {
        errors.push("pack_candidate_metric_ref_dangling");
        return [];
      }
      return [metric];
    });
    const evidenceRefs = new Set([
      ...candidate.evidenceRefs,
      ...candidateMetrics.flatMap((metric) => metric.evidenceRefs),
    ]);
    for (const evidenceRef of evidenceRefs) coveredEvidenceRefs.add(evidenceRef);
    if ([...evidenceRefs].some((ref) => !evidenceKinds.has(ref))) {
      errors.push("pack_candidate_evidence_binding_missing");
    }
    for (const taxonomyRef of candidateTaxonomies) {
      const rules = rulesByTaxonomy.get(taxonomyRef) ?? [];
      if (rules.length === 0) {
        errors.push("pack_candidate_rule_coverage_missing");
        continue;
      }
      for (const evidenceRef of evidenceRefs) {
        const evidenceKind = evidenceKinds.get(evidenceRef);
        if (
          evidenceKind &&
          !rules.some((rule) =>
            rule.acceptedEvidenceKinds.includes(evidenceKind),
          )
        ) {
          errors.push("pack_evidence_kind_not_applicable");
        }
      }
    }
  }
  if (
    value.evidenceBindings.some(
      (binding) => !coveredEvidenceRefs.has(binding.evidenceRef),
    )
  ) {
    errors.push("pack_evidence_binding_uncovered");
  }

  const uniqueErrors = [...new Set(errors)].sort();
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors };
}
