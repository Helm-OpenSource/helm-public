"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consumeMemberActivationAction } from "./member-activation-actions";
export function MemberActivationPanel() {
  const token = useRef("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (value) token.current = value;
  }, []);
  return <form className="mx-auto max-w-md space-y-4 p-8" onSubmit={event => {
    event.preventDefault();
    if (password !== confirmation) { setMessage("两次密码不一致。"); return; }
    startTransition(async () => {
      const result = await consumeMemberActivationAction({ token: token.current, password });
      setPassword(""); setConfirmation("");
      if (result.ok) { token.current = ""; setComplete(true); setMessage("密码已设置。请使用正常密码登录入口进入组织。"); }
      else setMessage(result.error);
    });
  }}>
    <h1 className="text-xl font-semibold">激活成员账号</h1>
    <p>使用组织管理员单独交付的一次性凭证设置首次密码。此流程不验证邮箱所有权。</p>
    {!complete && <><label className="block">首次密码<Input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={256} required /></label>
      <label className="block">确认密码<Input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={8} maxLength={256} required /></label>
      <p>至少 8 位，包含字母和数字。</p><Button disabled={pending} type="submit">{pending ? "提交中…" : "设置密码"}</Button></>}
    <p role="status">{message}</p>{complete && <a href="/login?tab=password">前往密码登录</a>}
  </form>;
}
