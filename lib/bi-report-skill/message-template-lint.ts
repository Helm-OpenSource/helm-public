import type { BiReportSkillPack } from "@/lib/bi-report-skill/types";

/**
 * Static lint for skill message templates.
 *
 * The renderer (message-renderer.ts) silently renders unknown placeholder
 * paths as an empty string, so a typo like `{{metrics.new_orders}}` (for a
 * metric actually keyed `new_work_orders`) produces a blank line in a report
 * that may still be delivered at ALERT severity. Real-data validation showed
 * this failure mode is easy to hit; this lint surfaces it as a warning at
 * run preparation instead of shipping an empty message.
 */

const KNOWN_ROOTS = new Set(["skill", "result", "run", "analysis", "metrics"]);

export function lintBiReportMessageTemplate(skill: BiReportSkillPack): string[] {
  const warnings: string[] = [];
  const template = skill.messageTemplate;
  const metricKeys = new Set(skill.metrics.aggregations.map((item) => item.key));

  // Paths introduced by loop blocks ({{#analysis.findings}} ... {{/...}})
  // scope item fields into the context, so only validate loop sources.
  const loopSources = new Set<string>();
  for (const match of template.matchAll(/{{#([\w.]+)}}/g)) {
    loopSources.add(match[1]);
  }

  for (const match of template.matchAll(/{{\s*([\w.]+|\.)\s*}}/g)) {
    const rawPath = match[1];
    if (rawPath === ".") continue;
    if (rawPath.startsWith("#") || rawPath.startsWith("/")) continue;

    const [root, ...rest] = rawPath.split(".");
    if (!KNOWN_ROOTS.has(root)) {
      // Could be a loop-item field; only warn when no loop is present.
      if (loopSources.size === 0) {
        warnings.push(
          `message template references unknown context root "${root}" in {{${rawPath}}} — it will render empty`,
        );
      }
      continue;
    }

    if (root === "metrics" && rest.length > 0 && !metricKeys.has(rest[0])) {
      warnings.push(
        `message template references unknown metric "{{${rawPath}}}" — declared metric keys: ${[...metricKeys].join(", ")}`,
      );
    }
  }

  return warnings;
}
