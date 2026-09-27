"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issueMemberActivationAction } from "./member-activation-actions";
export function MemberActivationAdmin({ members }: { members: Array<{ id: string; email: string }> }) {
  const [selected, setSelected] = useState(members[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [delivery, setDelivery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="max-w-xl space-y-4" onSubmit={event => {
    event.preventDefault(); setDelivery("");
    startTransition(async () => {
      const result = await issueMemberActivationAction({ membershipId: selected, password });
      setPassword("");
      if (!result.ok) { setMessage(result.error); return; }
      setDelivery(`${window.location.origin}/activate-member#token=${result.token}`);
      setMessage(`凭证有效期至 ${result.expiresAt}。新凭证使该成员旧凭证失效。`);
    });
  }}>
    <h1 className="text-xl font-semibold">成员首次激活</h1>
    <p>仅用于本组织独占邀请、尚未设置密码的成员。请确认收件人身份后，通过既定私密渠道单独交付。该凭证不是邮箱所有权证明。</p>
    <label className="block">受邀成员<select className="block w-full border p-2" value={selected} onChange={event => { setSelected(event.target.value); setDelivery(""); }} disabled={pending}>
      {members.map(member => <option key={member.id} value={member.id}>{member.email}</option>)}
    </select></label>
    <label className="block">再次验证当前管理员密码<Input type="password" autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <Button type="submit" disabled={pending || !selected}>{pending ? "生成中…" : "生成一次性激活凭证"}</Button>
    <p role="status">{message}</p>
    {delivery && <div className="space-y-2"><p>仅本次显示，关闭页面后无法找回。不要粘贴到公共群、工单或日志。</p><textarea aria-label="一次性激活链接" readOnly value={delivery} className="w-full border p-2" /><Button type="button" variant="outline" onClick={() => setDelivery("")}>清除显示</Button></div>}
  </form>;
}
