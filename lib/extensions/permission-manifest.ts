import { z } from "zod";

import {
  PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION,
  permissionDataClassificationSchema,
  permissionEffectModeSchema,
  permissionRiskLevelSchema,
  type PermissionActionPolicy,
  type PermissionPolicy,
} from "@/lib/auth/permission-policy";
import { redactionStatusSchema } from "@/lib/diagnostics/doctor-packet";

const permissionManifestFieldRedactionSchema = z.object({
  field: z.string().min(1),
  dataClassification: permissionDataClassificationSchema,
  defaultRedaction: redactionStatusSchema,
});

const permissionManifestResourceSchema = z.object({
  kind: z.string().min(1),
  displayName: z.string().min(1),
  dataClassifications: z.array(permissionDataClassificationSchema).min(1),
  supportsRowFilters: z.literal(true),
  fieldRedactions: z.array(permissionManifestFieldRedactionSchema).min(1),
});

const permissionManifestActionSchema = z.object({
  name: z.string().min(1),
  resourceKind: z.string().min(1),
  effectMode: permissionEffectModeSchema,
  riskLevel: permissionRiskLevelSchema,
  allowedDataClassifications: z.array(permissionDataClassificationSchema).min(1),
  supportsRowFilter: z.boolean(),
  supportsFieldRedaction: z.boolean(),
  obligations: z.array(z.string().min(1)).optional(),
});

export const permissionManifestSchema = z
  .object({
    schemaVersion: z.literal("helm.permission-manifest/v1"),
    packKey: z.string().min(1),
    policyVersion: z.string().min(1),
    resources: z.array(permissionManifestResourceSchema).min(1),
    actions: z.array(permissionManifestActionSchema).min(1),
  })
  .superRefine((manifest, ctx) => {
    const resourceKinds = new Set(manifest.resources.map((resource) => resource.kind));
    for (const resource of manifest.resources) {
      for (const fieldRedaction of resource.fieldRedactions) {
        const expected =
          PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION[
            fieldRedaction.dataClassification
          ];
        if (fieldRedaction.defaultRedaction !== expected) {
          ctx.addIssue({
            code: "custom",
            path: [
              "resources",
              resource.kind,
              "fieldRedactions",
              fieldRedaction.field,
              "defaultRedaction",
            ],
            message:
              `Field "${fieldRedaction.field}" must use canonical redaction "${expected}" ` +
              `for data classification "${fieldRedaction.dataClassification}".`,
          });
        }
      }
    }
    for (const action of manifest.actions) {
      if (!resourceKinds.has(action.resourceKind)) {
        ctx.addIssue({
          code: "custom",
          path: ["actions", action.name, "resourceKind"],
          message: `Action "${action.name}" references unknown resource kind "${action.resourceKind}".`,
        });
      }

      if (!action.supportsRowFilter || !action.supportsFieldRedaction) {
        ctx.addIssue({
          code: "custom",
          path: ["actions", action.name],
          message: `Action "${action.name}" must declare row-filter and field-redaction support.`,
        });
      }

      if (
        action.name.endsWith("execute_writeback") &&
        action.effectMode !== "blocked_side_effect"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["actions", action.name, "effectMode"],
          message: `Public Core writeback execution action "${action.name}" must stay blocked_side_effect.`,
        });
      }
    }
  });

export type PermissionManifest = z.infer<typeof permissionManifestSchema>;

export function validatePermissionManifest(input: unknown): PermissionManifest {
  const result = permissionManifestSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join("; ");
    throw new Error(
      `Invalid permission manifest data classifications or policy fields: ${details}`,
    );
  }
  return result.data;
}

export function buildPermissionPolicyFromManifest(input: unknown): PermissionPolicy {
  const manifest = validatePermissionManifest(input);
  const actions: Record<string, PermissionActionPolicy> = {};
  for (const action of manifest.actions) {
    actions[action.name] = {
      effectMode: action.effectMode,
      riskLevel: action.riskLevel,
      allowedDataClassifications: action.allowedDataClassifications,
      source: "pack_manifest",
      obligations: action.obligations ?? [],
    };
  }
  return {
    policyVersion: manifest.policyVersion,
    actions,
  };
}
