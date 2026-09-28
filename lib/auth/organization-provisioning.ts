import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ensureWorkspaceCommercialFoundation } from "@/lib/billing/foundation";
import { writeAuditLog } from "@/lib/audit";
const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
const inputSchema = z.object({
  workspaceId: ref, name: z.string().trim().min(1).max(100), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
  ownerEmail: z.string().trim().email().max(191).transform(value => value.toLowerCase()),
  ownerName: z.string().trim().min(1).max(100), actorUserId: ref, actorWorkspaceId: ref, commandId: ref, evidenceRef: ref,
}).strict();
export type InvitedOrganizationInput = z.input<typeof inputSchema>;
/**
 * Transaction-only primitive for a governed caller. The host must authorize and
 * lock its approval/grant, claim its idempotency command and write its enterprise
 * binding in this SAME transaction. This helper does not approve that business
 * registration, mint a session or add the platform operator as a tenant member.
 */
export async function provisionInvitedOrganization(tx: Prisma.TransactionClient, raw: InvitedOrganizationInput) {
  if ("$transaction" in tx) throw new Error("An existing transaction is required");
  const input = inputSchema.parse(raw);
  if (input.workspaceId === input.actorWorkspaceId) throw new Error("Invalid organization scope");
  const actor = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId: input.actorWorkspaceId, userId: input.actorUserId } }, include: { workspace: true } });
  if (!actor || actor.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(actor.role) || actor.workspace.status !== "ACTIVE") throw new Error("Organization provisioning unavailable");
  // Never attach or rename an existing global identity on email conflict.
  if (await tx.user.findUnique({ where: { email: input.ownerEmail }, select: { id: true } })) throw new Error("Organization owner identity already exists");
  const workspace = await tx.workspace.create({ data: { id: input.workspaceId, name: input.name, slug: input.slug,
    status: "ACTIVE", workspaceClass: "CUSTOMER", systemKey: null, defaultLocale: "zh-CN", pilotMode: true,
    captureConsentRequired: true, dataRetentionDays: 90, llmEnabled: false } });
  const user = await tx.user.create({ data: { email: input.ownerEmail, name: input.ownerName } });
  const membership = await tx.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER", status: "INVITED" } });
  await ensureWorkspaceCommercialFoundation(workspace.id, new Date(), tx);
  await writeAuditLog({ workspaceId: input.actorWorkspaceId, userId: input.actorUserId, actor: "platform administrator", actorType: "USER",
    actionType: "ORGANIZATION_PROVISIONED", targetType: "Workspace", targetId: workspace.id,
    summary: "Provisioned an organization with an invited initial owner; business approval and activation remain separate",
    payload: { commandId: input.commandId, evidenceRef: input.evidenceRef, workspaceId: workspace.id, membershipId: membership.id, userId: user.id } }, { client: tx });
  return { workspaceId: workspace.id, userId: user.id, membershipId: membership.id };
}
