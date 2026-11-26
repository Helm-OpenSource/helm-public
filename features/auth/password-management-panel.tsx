"use client";
import { useState } from "react";
import { changePasswordAction } from "./password-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function PasswordManagementPanel({ english, account, canReset, members }: {
  english: boolean; account: string; canReset: boolean; members: Array<{ id: string; label: string }>;
}) {
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const t = (zh: string, en: string) => english ? en : zh;
  return <section className="mx-auto w-full max-w-xl space-y-6 p-6">
    <h1 className="text-xl font-semibold">{t("账号安全", "Account security")}</h1>
    <p className="break-all">{account}</p>
    <form method="post" className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (pending || done) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      const newPassword = String(data.get("newPassword") ?? "");
      if (newPassword !== data.get("confirmation")) { setMessage(t("两次新密码不一致。", "New passwords do not match.")); return; }
      setPending(true); setMessage("");
      try {
        const result = await changePasswordAction({ currentPassword: String(data.get("currentPassword") ?? ""), newPassword, ...(target ? { membershipId: target } : {}) });
        form.reset();
        if (!result.ok) { setMessage(t("操作未确认。请核对当前密码、成员权限或稍后重试；结果不明时先尝试新密码登录。", "Change unconfirmed. Check your password and permissions or retry later; if uncertain, try signing in with the new password first.")); return; }
        if (result.signInRequired) setDone(true);
        setMessage(result.signInRequired ? t("密码已修改，已有登录已撤销。请重新登录。", "Password changed. Existing sign-ins revoked. Please sign in again.") : t("成员密码已重置，已有登录已撤销。请通过私密渠道交付新密码。", "Member password reset. Existing sign-ins revoked. Deliver the new password privately."));
      } catch { form.reset(); setMessage(t("操作结果尚未确认，请先尝试新密码登录。", "Result unconfirmed. Try signing in with the new password first.")); }
      finally { setPending(false); }
    }}>
      <fieldset disabled={pending || done} className="space-y-4">
        {canReset && <label className="block">{t("操作账号", "Account to change")}
          <select className="mt-1 w-full rounded-md border bg-background p-2" value={target} onChange={e => { setTarget(e.target.value); setMessage(""); e.currentTarget.form?.reset(); }}>
            <option value="">{t("我自己", "My account")}</option>{members.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>}
        <label className="block">{t("我的当前密码", "My current password")}<Input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <label className="block">{t("新密码（8–256 位，包含字母和数字）", "New password (8–256 characters, letters and digits)")}<Input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} /></label>
        <label className="block">{t("确认新密码", "Confirm new password")}<Input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={256} /></label>
        <p>{target ? t("将撤销该成员所有网页登录和桌面设备授权。", "All browser sign-ins and desktop device authorizations of this member will be revoked.") : t("修改后将退出所有网页登录，并撤销桌面设备授权。", "Changing your password signs out all browser sessions and revokes desktop device authorizations.")}</p>
        <Button type="submit">{pending ? t("提交中…", "Submitting…") : target ? t("重置所选成员密码", "Reset selected member password") : t("修改我的密码", "Change my password")}</Button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {done && <a className="underline" href="/login?tab=password">{t("重新登录", "Sign in again")}</a>}
  </section>;
}
