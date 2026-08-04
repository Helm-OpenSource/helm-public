/**
 * caio-connect distribution manifest contract. The packaging layer consumes
 * this: an unsigned or un-notarized binary can never reach "ok" distribution
 * status. Actual signing/notarization is performed by the platform release
 * pipeline, out of scope for this core.
 */

import { z } from "zod";

export const caioConnectManifestSchema = z.object({
  binaryName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  signed: z.boolean(),
  notarized: z.boolean(),
});

export type CaioConnectManifest = z.infer<typeof caioConnectManifestSchema>;

export type DistributionEvaluation =
  | { status: "ok"; manifest: CaioConnectManifest }
  | { status: "blocked:signing_required"; manifest: CaioConnectManifest }
  | { status: "invalid"; issues: string[] };

export function evaluateDistributionManifest(input: unknown): DistributionEvaluation {
  const parsed = caioConnectManifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  if (!parsed.data.signed || !parsed.data.notarized) {
    return { status: "blocked:signing_required", manifest: parsed.data };
  }
  return { status: "ok", manifest: parsed.data };
}
