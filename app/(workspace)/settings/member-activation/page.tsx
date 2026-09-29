import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { MemberActivationAdmin } from "@/features/auth/member-activation-admin";
export const dynamic = "force-dynamic";
export const metadata = { title: "成员首次激活", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function MemberActivationAdminPage() {
  if (process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED !== "true") notFound();
  const session = await getCurrentWorkspaceSession();
  if (session.membership.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(session.membership.role)) notFound();
  const members = await db.membership.findMany({ where: { workspaceId: session.workspace.id, status: "INVITED", user: { passwordHash: null, memberships: { none: { workspaceId: { not: session.workspace.id }, status: { not: "INACTIVE" } } } } }, select: { id: true, user: { select: { email: true } } }, take: 100, orderBy: { createdAt: "desc" } });
  return <section className="p-6"><MemberActivationAdmin members={members.map(member => ({ id: member.id, email: member.user.email }))} /></section>;
}
