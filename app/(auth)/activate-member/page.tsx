import { notFound } from "next/navigation";
import { MemberActivationPanel } from "@/features/auth/member-activation-panel";
export const dynamic = "force-dynamic";
export const metadata = { title: "成员激活", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function MemberActivationPage() {
  if (process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED !== "true") notFound();
  return <MemberActivationPanel />;
}
