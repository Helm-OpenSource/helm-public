import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  executeCaioOperation,
  type CaioOperationSummary,
  type CaioOperatorAccess,
  type CaioOperatorContext,
  type CaioOperatorResult,
} from "@/lib/caio-operator/operation-core";

export {
  summarizeOperationResult,
  type CaioOperationSummary,
  type CaioOperatorAccess,
  type CaioOperatorContext,
  type CaioOperatorResult,
} from "@/lib/caio-operator/operation-core";

/** Web entry: identity, role and locale come from the session, never from the client. */
export async function runOwnerOperation<S extends z.ZodTypeAny>(args: {
  access: CaioOperatorAccess;
  schema: S;
  rawInput: unknown;
  invoke: (ctx: CaioOperatorContext, input: z.infer<S>) => Promise<unknown>;
  revalidate?: readonly string[];
}): Promise<CaioOperatorResult<CaioOperationSummary>> {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const result = await executeCaioOperation({
    access: args.access,
    membershipRole: membership.role,
    context: {
      workspaceId: workspace.id,
      actorUserId: user.id,
      actorName: user.name,
      english: workspace.defaultLocale === "en-US",
    },
    schema: args.schema,
    rawInput: args.rawInput,
    invoke: args.invoke,
  });
  if (result.ok) {
    for (const path of args.revalidate ?? ["/caio", "/caio/operator"]) revalidatePath(path);
  }
  return result;
}
