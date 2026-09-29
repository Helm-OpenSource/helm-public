import { notFound } from "next/navigation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { AiAccessClient } from "@/features/member-mcp/ai-access-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "AI 工具接入", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function AiAccessPage() {
  if (process.env.HELM_MEMBER_MCP_ENABLED !== "true") notFound();
  const session = await getCurrentWorkspaceSession();
  if (session.membership.status !== "ACTIVE") notFound();
  return <section className="p-6"><AiAccessClient /></section>;
}
