import Link from "next/link";
import { getRequestUiLocaleCandidate } from "@/lib/i18n/request-locale.server";

export const metadata = { title: "Invitation pending", robots: { index: false, follow: false } };

export default async function InvitePendingPage() {
  const english = (await getRequestUiLocaleCandidate()) === "en-US";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-5 px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">
        {english ? "Workspace invitation" : "工作区邀请"}
      </p>
      <h1 className="text-3xl font-semibold text-[color:var(--foreground)]">
        {english ? "Your invitation is still pending" : "你的邀请仍待处理"}
      </h1>
      <p className="text-base leading-7 text-[color:var(--muted-foreground)]">
        {english
          ? "This workspace invitation is still pending, so this workspace is not available yet. Automatic invite activation is disabled for this workspace. Ask its owner or an admin to review the setting; they cannot accept the invitation for you. If enabled, sign in and choose this workspace yourself."
          : "此工作区邀请仍待处理，当前工作区尚未激活，暂不可访问。此工作区已关闭自动激活邀请。请联系工作区负责人或管理员检查设置；他们不能代替你接受邀请。若设置开启，请由你本人重新登录并选择此工作区。"}
      </p>
      <Link className="w-fit underline" href="/login">
        {english ? "Continue to sign in" : "前往登录"}
      </Link>
    </main>
  );
}
