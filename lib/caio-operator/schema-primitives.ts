import { z } from "zod";

/** Field primitives shared by the CAIO operator web schemas and the governance CLI schemas. */

export const ref = z.string().trim().min(1).max(191);
export const text = (max: number) => z.string().trim().min(1).max(max);
export const refs = z.array(ref).max(100);
// Principal refs must stay colon-free (grant-basis issuer format enforced by the store).
export const principalRef = ref.refine((value) => !value.includes(":"), { message: "principal_ref_colon" });
export const instant = z.string().datetime({ offset: true });
export const instantDate = instant.transform((value) => new Date(value));
export const positiveInt = (max: number) => z.number().int().min(1).max(max);
