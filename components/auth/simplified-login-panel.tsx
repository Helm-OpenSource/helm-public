"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  beginPublicPhoneEntryAction,
  loginWithPhoneCodeAction,
  passwordLoginAction,
} from "@/features/auth/actions";
import type { UiLocale } from "@/lib/i18n/config";

type SimplifiedLoginPanelProps = {
  locale: UiLocale;
};

type LoginTab = "phone" | "email";

const CHINA_PHONE_LENGTH = 11;
const CHINA_PHONE_INPUT_MAX_LENGTH = 20;

function sanitizeChinaPhoneInput(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("86") && digits.length > CHINA_PHONE_LENGTH) {
    digits = digits.slice(2);
  }

  return digits.slice(0, CHINA_PHONE_LENGTH);
}

function getChinaPhoneInputError(value: string, english: boolean) {
  const digits = sanitizeChinaPhoneInput(value);

  if (!digits) {
    return null;
  }

  if (digits.length < CHINA_PHONE_LENGTH) {
    return english ? "Enter all 11 digits." : "请输入完整 11 位手机号。";
  }

  if (!/^1[3-9]\d{9}$/.test(digits)) {
    return english
      ? "Use a valid Mainland China mobile number."
      : "请输入有效的中国大陆手机号。";
  }

  return null;
}

export function SimplifiedLoginPanel({ locale }: SimplifiedLoginPanelProps) {
  const router = useRouter();
  const english = locale === "en-US";
  const [activeTab, setActiveTab] = useState<LoginTab>("phone");
  const [pending, setPending] = useState(false);

  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [showPhoneCodeInput, setShowPhoneCodeInput] = useState(false);
  const [phoneCodePreview, setPhoneCodePreview] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const phoneInputError = getChinaPhoneInputError(phone, english);

  const handlePhoneSubmit = async () => {
    if (!phone || phoneInputError) {
      toast.error(english ? "Please enter valid phone number" : "请输入有效的手机号");
      return;
    }

    setPending(true);
    try {
      if (showPhoneCodeInput) {
        const result = await loginWithPhoneCodeAction({
          phone,
          code: phoneCode,
          locale,
        });

        if (!result.ok || !("redirectTo" in result)) {
          toast.error(result.error || (english ? "Login failed" : "登录失败"));
          return;
        }

        setPhoneCodePreview(null);
        toast.success(
          result.requiresWorkspaceSelection
            ? english
              ? "Choose an organization before continuing."
              : "请先选择要进入的组织。"
            : english
              ? "Login successful"
              : "登录成功",
        );
        router.push(result.redirectTo);
        router.refresh();
      } else {
        const result = await beginPublicPhoneEntryAction({ phone, locale });

        if (!result.ok) {
          toast.error(result.error || (english ? "Failed to send code" : "发送验证码失败"));
          return;
        }

        if (result.mode === "signup") {
          router.push(result.signupHref);
          return;
        }

        setPhoneCodePreview(result.verificationPreview.phoneCode ?? null);
        setShowPhoneCodeInput(true);
        toast.success(english ? "Verification code sent" : "验证码已发送");
      }
    } catch {
      toast.error(english ? "Operation failed" : "操作失败");
    } finally {
      setPending(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error(english ? "Please enter email and password" : "请输入邮箱和密码");
      return;
    }

    setPending(true);
    try {
      const result = await passwordLoginAction({
        identifier: email,
        password,
        locale,
      });

      if (!result.ok || !("redirectTo" in result)) {
        toast.error(result.error || (english ? "Login failed" : "登录失败"));
        return;
      }

      toast.success(
        result.requiresWorkspaceSelection
          ? english
            ? "Choose an organization before continuing."
            : "请先选择要进入的组织。"
          : english
            ? "Login successful"
            : "登录成功",
      );
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      toast.error(english ? "Operation failed" : "操作失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => {
              setActiveTab("phone");
              setShowPhoneCodeInput(false);
              setPhoneCodePreview(null);
            }}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition ${
              activeTab === "phone"
                ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                : "bg-[color:var(--surface-subtle)] text-[color:var(--foreground)] hover:bg-[color:var(--border)] dark:bg-[color:var(--dark-inset-overlay)] dark:text-[color:var(--muted-foreground)]"
            }`}
          >
            <Phone className="h-4 w-4 mr-2" />
            {english ? "Phone" : "手机号"}
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition ${
              activeTab === "email"
                ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                : "bg-[color:var(--surface-subtle)] text-[color:var(--foreground)] hover:bg-[color:var(--border)] dark:bg-[color:var(--dark-inset-overlay)] dark:text-[color:var(--muted-foreground)]"
            }`}
          >
            <Mail className="h-4 w-4 mr-2" />
            {english ? "Email" : "邮箱"}
          </button>
        </div>

        {activeTab === "phone" && (
          <div className="space-y-4">
            {!showPhoneCodeInput ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--foreground)] dark:text-[color:var(--muted-foreground)] mb-2">
                    {english ? "Phone Number" : "手机号"}
                  </label>
                  <div className="min-h-5">
                    {phoneInputError ? (
                      <p
                        className="text-sm text-[color:var(--accent-warm)]"
                        data-testid="phone-login-phone-error"
                      >
                        {phoneInputError}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    data-testid="phone-login-phone"
                    type="tel"
                    placeholder={english ? "Enter your phone number" : "请输入手机号"}
                    value={phone}
                    onChange={(event) =>
                      setPhone(sanitizeChinaPhoneInput(event.target.value))
                    }
                    className="text-lg"
                    maxLength={CHINA_PHONE_INPUT_MAX_LENGTH}
                  />
                </div>
                <Button
                  data-testid="phone-login-request"
                  onClick={handlePhoneSubmit}
                  disabled={pending || !phone || Boolean(phoneInputError)}
                  className="w-full"
                  size="lg"
                >
                  {pending ? (
                    english ? "Sending..." : "发送中..."
                  ) : (
                    <>
                      {english ? "Send Verification Code" : "发送验证码"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--foreground)] dark:text-[color:var(--muted-foreground)] mb-2">
                    {english ? "Verification Code" : "验证码"}
                  </label>
                  {phoneCodePreview ? (
                    <p
                      className="mb-3 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
                      data-testid="phone-login-code-preview"
                    >
                      {english ? "Code" : "验证码"}: {phoneCodePreview}
                    </p>
                  ) : null}
                  <Input
                    data-testid="phone-login-code"
                    type="text"
                    placeholder={english ? "Enter 6-digit code" : "请输入6位验证码"}
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value)}
                    className="text-lg text-center tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button
                  data-testid="phone-login-submit"
                  onClick={handlePhoneSubmit}
                  disabled={pending}
                  className="w-full"
                  size="lg"
                >
                  {pending ? (
                    english ? "Verifying..." : "验证中..."
                  ) : (
                    <>
                      {english ? "Sign In" : "登录"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowPhoneCodeInput(false);
                    setPhoneCodePreview(null);
                    setPhoneCode("");
                  }}
                  className="w-full"
                >
                  {english ? "Back" : "返回"}
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[color:var(--foreground)] dark:text-[color:var(--muted-foreground)] mb-2">
                {english ? "Email" : "邮箱"}
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--foreground)] dark:text-[color:var(--muted-foreground)] mb-2">
                {english ? "Password" : "密码"}
              </label>
              <Input
                type="password"
                placeholder={english ? "Enter password" : "请输入密码"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="text-lg"
              />
            </div>
            <Button
              onClick={handleEmailLogin}
              disabled={pending}
              className="w-full"
              size="lg"
            >
              {pending ? (
                english ? "Signing in..." : "登录中..."
              ) : (
                <>
                  {english ? "Sign In" : "登录"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[color:var(--border)] dark:border-[color:var(--dark-inset-border)] text-center">
          <p className="text-sm text-[color:var(--muted)] dark:text-[color:var(--muted-foreground)]">
            {english ? "New user?" : "新用户？"}{" "}
            <Link href="/login?tab=signup" className="text-[color:var(--status-info-text)] hover:text-[color:var(--status-info-text)] font-medium">
              {english ? "Create account" : "创建账号"}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
