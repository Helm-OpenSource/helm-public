/**
 * Source Profiler — ScopeManifest
 *
 * Declares what the deterministic profiler is allowed to scan, how it should
 * degrade, the secret preflight posture, the optional DB-catalog allowlist, and
 * the output policy. The manifest is the user-authored authorization boundary:
 * the profiler scans nothing outside it.
 */

import { z } from "zod";

export const secretPreflightModeSchema = z.enum(["strict", "warn", "off"]);
export type SecretPreflightMode = z.infer<typeof secretPreflightModeSchema>;

export const scopeManifestSchema = z
  .object({
    /** Contract version of this manifest shape. */
    version: z.literal("1"),
    /** Source root to scan, relative to where the CLI is invoked (or absolute). */
    root: z.string().min(1).default("."),
    /**
     * Path prefixes (POSIX, relative to `root`) the profiler may enter. Empty
     * means "everything under root not excluded".
     */
    include: z.array(z.string()).default([]),
    /** Path prefixes to skip, in addition to .gitignore when enabled. */
    exclude: z
      .array(z.string())
      .default(["node_modules/", ".git/", ".helm-profiler/", "dist/", "build/"]),
    /** Merge the repo's .gitignore into the exclude set. */
    respectGitignore: z.boolean().default(true),
    /** Files larger than this are skipped (recorded, not read). */
    maxFileSizeBytes: z
      .number()
      .int()
      .positive()
      .default(2 * 1024 * 1024),
    /** Skip files detected as binary (NUL byte sniff). */
    skipBinary: z.boolean().default(true),
    secretPreflight: z
      .object({
        mode: secretPreflightModeSchema.default("strict"),
        /** Extra regex source strings appended to the built-in secret rules. */
        extraPatterns: z.array(z.string()).default([]),
      })
      .default({ mode: "strict", extraPatterns: [] }),
    /**
     * Optional DB catalog introspection (PR4). Catalog-only; never reads
     * business rows. Disabled unless explicitly enabled here AND via the
     * `--db-catalog` flag.
     */
    dbCatalog: z
      .object({
        enabled: z.boolean().default(false),
        engine: z.enum(["postgres", "mysql", "sqlite"]).optional(),
        /** Allowlisted schemas; empty means "no schema permitted". */
        schemas: z.array(z.string()).default([]),
        /** Allowlisted tables (schema-qualified or bare); empty means all in allowed schemas. */
        tables: z.array(z.string()).default([]),
      })
      .default({ enabled: false, schemas: [], tables: [] }),
    output: z
      .object({
        /** Directory for run outputs; must be gitignored. */
        dir: z.string().min(1).default(".helm-profiler/runs"),
        /** Redact identifiers in the shareable export by default. */
        redactByDefault: z.boolean().default(true),
      })
      .default({ dir: ".helm-profiler/runs", redactByDefault: true }),
  })
  .strict();

export type ScopeManifest = z.infer<typeof scopeManifestSchema>;

/** Parse + apply defaults; throws z.ZodError on invalid input. */
export function parseScopeManifest(input: unknown): ScopeManifest {
  return scopeManifestSchema.parse(input);
}

/** A safe default manifest used by `init` to scaffold a template. */
export function defaultScopeManifest(root = "."): ScopeManifest {
  return scopeManifestSchema.parse({ version: "1", root });
}
