import { db } from "@/lib/db";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { PasswordManagementPanel } from "@/features/auth/password-management-panel";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account security", robots: { index: false, follow: false } };
export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const role = session.membership.role;
  const english = (await resolveWorkspaceUiLocaleForRequest({ workspaceDefaultLocale: session.workspace.defaultLocale })) === "en-US";
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 191) : "";
  const members = ["OWNER", "ADMIN"].includes(role) ? await db.membership.findMany({
    where: { workspaceId: session.workspace.id, status: "ACTIVE", accessScope: null, userId: { not: session.user.id },
      ...(role === "ADMIN" ? { role: { notIn: ["OWNER", "ADMIN"] } } : {}),
      user: { ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}), passwordHash: { not: null }, memberships: { none: { workspaceId: { not: session.workspace.id }, status: { not: "INACTIVE" } } } } },
    select: { id: true, user: { select: { name: true, email: true } } }, orderBy: { id: "asc" }, take: 100,
  }) : [];
  return <>
    {["OWNER", "ADMIN"].includes(role) && <form className="mx-auto w-full max-w-xl space-y-2 px-6 pt-6" method="get">
      <label className="block">{english ? "Find member (up to 100 matches)" : "查找成员（最多显示 100 条）"}<input className="w-full rounded-md border bg-background p-2" name="q" defaultValue={q} maxLength={191} /></label>
      <button className="underline" type="submit">{english ? "Search" : "查找"}</button>
    </form>}
    <PasswordManagementPanel english={english} account={session.user.email}
    canReset={["OWNER", "ADMIN"].includes(role)} members={members.map(m => ({ id: m.id, label: `${m.user.name} · ${m.user.email}` }))} /></>;
}
