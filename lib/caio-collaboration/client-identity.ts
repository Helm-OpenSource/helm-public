import { z } from "zod";

import {
  workBuddyClientIdentitySchema,
  type WorkBuddyClientIdentity,
} from "./contracts";

export const workBuddyMtlsPeerSchema = z
  .object({
    certificateFingerprint: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/),
    sourceAddress: z.string().min(2).max(64),
    authorized: z.literal(true),
  })
  .strict();

export type WorkBuddyMtlsPeer = z.infer<
  typeof workBuddyMtlsPeerSchema
>;

/**
 * Private deployment code owns certificate lookup and revocation. The public
 * service accepts only the resulting bounded identity, never raw certificates.
 */
export interface WorkBuddyClientIdentityResolver {
  resolve(peer: WorkBuddyMtlsPeer): Promise<WorkBuddyClientIdentity | null>;
}

export async function resolveVerifiedWorkBuddyClientIdentity(input: {
  peer: WorkBuddyMtlsPeer;
  resolver: WorkBuddyClientIdentityResolver;
}): Promise<WorkBuddyClientIdentity | null> {
  const peer = workBuddyMtlsPeerSchema.parse(input.peer);
  const identity = await input.resolver.resolve(peer);
  if (identity === null) return null;
  const verifiedIdentity =
    workBuddyClientIdentitySchema.parse(identity);
  if (
    verifiedIdentity.certificateFingerprint !==
    peer.certificateFingerprint
  ) {
    return null;
  }
  return verifiedIdentity;
}
