"use client";

import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  KeyRound,
  MailCheck,
  Smartphone,
  UserPlus2,
} from "lucide-react";
import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider";
import { WorkspaceFormAssistPanel } from "@/components/shared/workspace-form-assist-panel";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  beginPublicPhoneEntryAction,
  completeTrialSignupVerificationAction,
  loginAction,
  loginWithPhoneCodeAction,
  passwordLoginAction,
  startTrialSignupAction,
} from "@/features/auth/actions";
import { PublicSsoPanel, type PublicSsoOption } from "@/features/auth/public-sso-panel";
import {
  buildLoginSuccessMessage,
  type LoginWorkspaceEntryKind,
} from "@/lib/auth/public-entry";
import type { UiLocale } from "@/lib/i18n/config";
import { defaultWorkspaceFeatureFlags } from "@/lib/workspace-ops";

type LoginPanelProps = {
  locale: UiLocale;
  surface?: "landing" | "landing-compact" | "login";
  initialTab?: "signup" | "password" | "phone";
  prefillSignup?: {
    name?: string;
    email?: string;
    phone?: string;
    organizationName?: string;
    title?: string;
  };
  prefillCompatibilityEmail?: string;
  autoContinueCompatibility?: boolean;
  publicSsoOptions?: PublicSsoOption[];
  entryIntent?: "dingtalk-invite" | "new-trial" | "returning" | "compatibility";
};

type LoginPanelTab = "signup" | "password" | "phone";

type VerificationPreview = {
  deliveryMode: "IN_APP_PREVIEW";
  email: string;
  phone: string;
  emailCode: string | null;
  phoneCode: string | null;
};

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

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-[color:var(--foreground)]">
      {children}
    </label>
  );
}

export function LoginPanel({
  locale,
  surface,
  initialTab,
  prefillSignup,
  prefillCompatibilityEmail,
  autoContinueCompatibility,
  publicSsoOptions,
  entryIntent,
}: LoginPanelProps) {
  return (
    <WorkspaceUiProvider
      locale={locale}
      pilotMode
      captureConsentRequired
      dataRetentionDays={90}
      featureFlags={defaultWorkspaceFeatureFlags}
      demoMode={null}
    >
      <LoginPanelSurface
        locale={locale}
        surface={surface}
        initialTab={initialTab}
        prefillSignup={prefillSignup}
        prefillCompatibilityEmail={prefillCompatibilityEmail}
        autoContinueCompatibility={autoContinueCompatibility}
        publicSsoOptions={publicSsoOptions}
        entryIntent={entryIntent}
      />
    </WorkspaceUiProvider>
  );
}

function LoginPanelSurface({
  locale,
  surface,
  initialTab,
  prefillSignup,
  prefillCompatibilityEmail,
  autoContinueCompatibility,
  publicSsoOptions,
  entryIntent,
}: LoginPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const english = locale === "en-US";
  const presentation = surface ?? (pathname === "/login" ? "login" : "landing");
  const compactLandingMode = presentation === "landing-compact";
  const landingMode = presentation === "landing" || compactLandingMode;
  const inviteEntryMode = presentation === "login" && entryIntent === "dingtalk-invite";
  const newTrialEntryMode = presentation === "login" && entryIntent === "new-trial";
  const returningEntryMode = presentation === "login" && entryIntent === "returning";
  const compatibilityEntryMode = presentation === "login" && entryIntent === "compatibility";
  const resolvedInitialTab = inviteEntryMode || newTrialEntryMode
    ? "signup"
    : returningEntryMode || compatibilityEntryMode
      ? "password"
      : initialTab ?? (presentation === "login" ? "password" : compactLandingMode ? "phone" : "signup");
  const [activeTab, setActiveTab] = useState<LoginPanelTab>(resolvedInitialTab);
  const [signup, setSignup] = useState({
    name: prefillSignup?.name ?? "",
    email: prefillSignup?.email ?? "",
    phone: sanitizeChinaPhoneInput(prefillSignup?.phone ?? ""),
    organizationName: prefillSignup?.organizationName ?? "",
    title: prefillSignup?.title ?? "",
    password: "",
    confirmPassword: "",
  });
  const [signupCodes, setSignupCodes] = useState({
    emailCode: "",
    phoneCode: "",
  });
  const [signupVerification, setSignupVerification] = useState<{
    enrollmentId: string;
    preview: VerificationPreview;
    requiresVerificationCodes: boolean;
  } | null>(null);
  const [passwordLogin, setPasswordLogin] = useState({
    identifier: "",
    password: "",
  });
  const [phoneLogin, setPhoneLogin] = useState({
    phone: sanitizeChinaPhoneInput(prefillSignup?.phone ?? ""),
    code: "",
  });
  const [phoneLoginPreview, setPhoneLoginPreview] = useState<VerificationPreview | null>(null);
  const [landingPhoneStep, setLandingPhoneStep] = useState<"entry" | "verify">("entry");
  const [landingConsentAccepted, setLandingConsentAccepted] = useState(false);
  const [compatibilityEmail, setCompatibilityEmail] = useState(prefillCompatibilityEmail ?? "");
  const [signupPending, startSignupTransition] = useTransition();
  const [completePending, startCompleteTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [phoneCodePending, startPhoneCodeTransition] = useTransition();
  const [compatibilityPending, startCompatibilityTransition] = useTransition();
  const runtimeReady = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const compatibilityAutoTriggeredRef = useRef(false);
  const resolvedPublicSsoOptions = publicSsoOptions?.length
    ? publicSsoOptions
    : [
        {
          provider: "dingtalk" as const,
          ready: false,
          startUrl: null,
        },
        {
          provider: "feishu" as const,
          ready: false,
          startUrl: null,
        },
      ];

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  useEffect(() => {
    const nextPhone = sanitizeChinaPhoneInput(prefillSignup?.phone ?? "");
    if (!nextPhone) {
      return;
    }

    setSignup((current) =>
      current.phone === nextPhone ? current : { ...current, phone: nextPhone },
    );
    setPhoneLogin((current) =>
      current.phone === nextPhone ? current : { ...current, phone: nextPhone },
    );
  }, [prefillSignup?.phone]);

  const verificationBoundaryNote = english
    ? "Formal verification is already part of the product flow. Signup email codes are sent from the system mailbox when configured, and in-page previews only appear in non-production fallback or explicitly allowed preview windows."
    : "正式验证已经进入产品主流程。注册邮箱验证码在配置后由系统邮箱发送，页面内预览只会出现在非生产回退或明确允许的受控预览窗口。";
  const inferredOrganizationName = inferOrganizationNameFromEmail(signup.email);
  const loginGuidanceRecommendations = [
    {
      title:
        activeTab === "signup"
          ? english
            ? "Start with verified signup for new workspaces"
            : "新工作区先走正式验证注册"
          : activeTab === "password"
            ? english
              ? "Use password sign-in for returning members"
              : "回到已有组织时优先用密码登录"
            : english
              ? "Use DingTalk scan for governed quick re-entry"
              : "已有成员优先走钉钉扫码的受控回流入口",
      body:
        activeTab === "signup"
          ? english
            ? "Email, phone and password establish the real identity chain before the workspace is created."
            : "邮箱、手机号和密码先把真实身份链建好，再创建工作区。"
          : activeTab === "password"
            ? english
              ? "Password sign-in keeps the shortest path when the member already finished enrollment."
              : "如果成员已经完成入组和验证，密码登录路径最短。"
            : english
              ? "DingTalk scan keeps sign-in explicit while reducing typing for returning members."
              : "钉钉扫码在保持显式认证的同时，降低已有成员的回流输入成本。",
    },
    {
      title: english ? "Keep identity and workspace aligned" : "让身份链和工作区入口保持对齐",
      body: english
        ? "The compatibility path is still available, but it should stay narrow and not replace the formal identity flow."
        : "兼容入口仍然保留，但它应该继续保持窄边界，不能替代正式身份流程。",
    },
    {
      title: english ? "Use assist only where it removes friction" : "只在真正减少摩擦的地方启用辅助",
      body: english
        ? "Autofill here should only shorten typing or preserve context. It must not create or commit anything automatically."
        : "这里的自动填充只负责减少输入和保留上下文，不会自动创建或提交任何东西。",
    },
  ];
  const loginGuidanceReminders = [
    {
      title: english ? "Current delivery mode" : "当前投递方式",
      body: verificationBoundaryNote,
      meta:
        signupVerification?.preview.emailCode || phoneLoginPreview?.phoneCode
          ? english
            ? "Codes are visible in the current controlled-trial surface."
            : "当前受控试点环境会直接显示验证码。"
          : undefined,
    },
    {
      title: english ? "Boundary posture" : "边界状态",
      body: english
        ? "This surface authenticates and routes the user, but it does not expand execution authority inside the workspace."
        : "这个界面负责身份认证和路由进入，不会扩大工作区里的执行权限。",
    },
  ];

  const loginAssistActions = [
    activeTab === "signup" && inferredOrganizationName && !signup.organizationName
      ? {
          label: english
            ? `Use “${inferredOrganizationName}” as organization name`
            : `用“${inferredOrganizationName}”填充组织名称`,
          onClick: () =>
            setSignup((current) => ({
              ...current,
              organizationName: inferredOrganizationName,
            })),
        }
      : null,
    activeTab !== "password"
      ? {
          label: english ? "Switch to password sign-in" : "切换到密码登录",
          onClick: () => setActiveTab("password"),
        }
      : null,
    activeTab !== "phone"
      ? {
          label: english ? "Switch to DingTalk scan" : "切换到钉钉扫码",
          onClick: () => setActiveTab("phone"),
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);
  const signupPhoneError = getChinaPhoneInputError(signup.phone, english);
  const phoneLoginError = getChinaPhoneInputError(phoneLogin.phone, english);
  const inviteOrganizationName = signup.organizationName.trim();
  const inviteDisplayName = signup.name.trim();
  const inviteTitle = signup.title.trim();

  const handleLoginSuccess = useCallback((result: {
    ok: boolean;
    error?: string;
    redirectTo?: string;
    workspaceName?: string;
    entryKind?: string;
    requiresWorkspaceSelection?: boolean;
  }) => {
    if (!result.ok || !result.redirectTo) {
      toast.error(result.error ?? (english ? "Unable to continue" : "当前无法继续进入"));
      return;
    }

    if (result.requiresWorkspaceSelection) {
      toast.success(
        english
          ? "Choose an organization before continuing."
          : "请先选择要进入的组织。",
      );
    } else if (result.workspaceName && result.entryKind) {
      toast.success(
        buildLoginSuccessMessage({
          locale,
          workspaceName: result.workspaceName,
          entryKind: result.entryKind as LoginWorkspaceEntryKind,
        }),
      );
    } else {
      toast.success(english ? "Login successful" : "登录成功");
    }
    router.push(result.redirectTo);
    router.refresh();
  }, [english, locale, router]);

  const startSignup = () => {
    if (signupPhoneError) {
      toast.error(signupPhoneError);
      return;
    }

    startSignupTransition(async () => {
      const result = await startTrialSignupAction({
        ...signup,
        locale,
      });

      if (!result.ok || result.step !== "verify" || !result.enrollmentId || !result.verificationPreview) {
        toast.error(result.error ?? (english ? "Unable to start verified signup" : "当前无法开始正式验证注册"));
        return;
      }

      const requiresVerificationCodes = result.requiresVerificationCodes ?? true;
      if (!requiresVerificationCodes) {
        const completeResult = await completeTrialSignupVerificationAction({
          enrollmentId: result.enrollmentId,
          emailCode: "",
          phoneCode: "",
          title: signup.title,
          locale,
        });

        if (!completeResult.ok || !completeResult.redirectTo) {
          setSignupVerification({
            enrollmentId: result.enrollmentId,
            preview: result.verificationPreview,
            requiresVerificationCodes: false,
          });
          setActiveTab("signup");
          toast.error(
            completeResult.error ??
              (english ? "Unable to complete signup" : "当前无法完成注册"),
          );
          return;
        }

        toast.success(english ? "Signup completed" : "注册已完成");
        router.push(completeResult.redirectTo);
        router.refresh();
        return;
      }

      setSignupVerification({
        enrollmentId: result.enrollmentId,
        preview: result.verificationPreview,
        requiresVerificationCodes: true,
      });
      setActiveTab("signup");
      toast.success(english ? "Verification codes are ready" : "验证码已准备好");
    });
  };

  const completeSignup = () => {
    if (!signupVerification) {
      toast.error(english ? "Start verified signup first" : "请先开始正式验证注册");
      return;
    }

    startCompleteTransition(async () => {
      const result = await completeTrialSignupVerificationAction({
        enrollmentId: signupVerification.enrollmentId,
        emailCode: signupVerification.requiresVerificationCodes ? signupCodes.emailCode : "",
        phoneCode: signupVerification.requiresVerificationCodes ? signupCodes.phoneCode : "",
        title: signup.title,
        locale,
      });

      if (!result.ok || !result.redirectTo) {
        toast.error(result.error ?? (english ? "Unable to complete signup" : "当前无法完成注册"));
        return;
      }

      toast.success(english ? "Trial workspace created" : "试用工作区已创建");
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  const loginWithPassword = () => {
    startPasswordTransition(async () => {
      const result = await passwordLoginAction({ ...passwordLogin, locale });
      handleLoginSuccess(result);
    });
  };

  const loginWithPhoneCode = () => {
    startPhoneCodeTransition(async () => {
      const result = await loginWithPhoneCodeAction({ ...phoneLogin, locale });
      handleLoginSuccess(result);
    });
  };

  const continueWithWorkEmail = () => {
    startCompatibilityTransition(async () => {
      const result = await loginAction({ email: compatibilityEmail, locale });
      handleLoginSuccess(result);
    });
  };

  useEffect(() => {
    if (!autoContinueCompatibility || compatibilityAutoTriggeredRef.current) {
      return;
    }

    const email = compatibilityEmail.trim();
    if (!email) {
      return;
    }

    compatibilityAutoTriggeredRef.current = true;
    startCompatibilityTransition(async () => {
      const result = await loginAction({ email, locale });
      handleLoginSuccess(result);
    });
  }, [autoContinueCompatibility, compatibilityEmail, handleLoginSuccess, locale]);

  const continueLandingPhoneEntry = () => {
    if (phoneLoginError) {
      toast.error(phoneLoginError);
      return;
    }

    startPhoneCodeTransition(async () => {
      const result = await beginPublicPhoneEntryAction({
        phone: phoneLogin.phone,
        locale,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Unable to continue" : "当前无法继续"));
        return;
      }

      if (result.mode === "signup") {
        router.push(result.signupHref);
        return;
      }

      setPhoneLogin((current) => ({
        ...current,
        phone: sanitizeChinaPhoneInput(result.phone),
      }));
      setPhoneLoginPreview(result.verificationPreview);
      setLandingPhoneStep("verify");
      toast.success(english ? "Verification code is ready" : "验证码已准备好");
    });
  };

  if (compactLandingMode) {
    return (
      <div className="space-y-4" data-testid="public-landing-phone-login">
        <div
          aria-hidden="true"
          className="sr-only"
          data-ready={runtimeReady ? "true" : "false"}
          data-testid="login-panel-runtime-ready"
          suppressHydrationWarning
        />
        <div className="overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_95%,white_5%)] shadow-sm">
          <div className="grid gap-0 xl:grid-cols-[1.04fr_0.96fr] xl:items-stretch">
            <div className="p-5 xl:p-6">
              <PublicSsoPanel locale={locale} options={resolvedPublicSsoOptions} />
            </div>

            <div className="border-t border-[color:var(--border)] p-5 xl:border-l xl:border-t-0 xl:p-6">
              <div className="flex min-h-[228px] flex-col">
                  <div className="mt-auto space-y-4">
                    <div className="space-y-3">
                      <label htmlFor="phone-login-phone" className="sr-only">
                        {english ? "Phone number" : "手机号"}
                      </label>
                      <div className="min-h-5">
                        {phoneLoginError ? (
                          <p
                            className="text-sm text-[color:var(--accent-warm)]"
                            data-testid="phone-login-phone-error"
                          >
                            {phoneLoginError}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 rounded-[28px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,white_10%)] px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
                          <Smartphone className="h-4 w-4" />
                          <span>+86</span>
                        </div>
                      <div className="h-8 w-px bg-[color:var(--border)]" />
                      <Input
                        id="phone-login-phone"
                        data-testid="phone-login-phone"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={CHINA_PHONE_INPUT_MAX_LENGTH}
                        value={phoneLogin.phone}
                        onChange={(event) =>
                          setPhoneLogin((current) => ({
                            ...current,
                            phone: sanitizeChinaPhoneInput(event.target.value),
                          }))
                        }
                        placeholder={english ? "Phone number" : "请输入手机号"}
                        className="border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                      />
                    </div>

                    <Button
                      className="h-12 w-full text-base"
                      data-testid="phone-login-request"
                      aria-label={
                        english ? "Send phone verification code" : "发送手机验证码"
                      }
                      onClick={continueLandingPhoneEntry}
                      disabled={
                        phoneCodePending ||
                        !landingConsentAccepted ||
                        !phoneLogin.phone ||
                        Boolean(phoneLoginError)
                      }
                    >
                      {phoneCodePending
                        ? english
                          ? "Preparing..."
                          : "正在处理..."
                        : english
                          ? "Next"
                          : "下一步"}
                    </Button>

                    {landingPhoneStep === "verify" ? (
                      <div className="space-y-3 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
                        {phoneLoginPreview ? (
                          <div className="workspace-panel-muted rounded-2xl border border-dashed p-4">
                            <p className="text-sm text-[color:var(--muted-foreground)]">
                              {phoneLoginPreview.phone}
                            </p>
                            <p
                              className="mt-2 text-base font-semibold text-[color:var(--foreground)]"
                              data-testid="phone-login-code-preview"
                            >
                              {english ? "Code" : "验证码"}: {phoneLoginPreview.phoneCode ?? "--"}
                            </p>
                          </div>
                        ) : null}

                        <label htmlFor="phone-login-code" className="sr-only">
                          {english ? "Verification code" : "验证码"}
                        </label>
                        <Input
                          id="phone-login-code"
                          data-testid="phone-login-code"
                          inputMode="numeric"
                          value={phoneLogin.code}
                          onChange={(event) =>
                            setPhoneLogin((current) => ({ ...current, code: event.target.value }))
                          }
                          placeholder={english ? "Verification code" : "请输入验证码"}
                        />

                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            data-testid="phone-login-submit"
                            onClick={loginWithPhoneCode}
                            disabled={
                              phoneCodePending ||
                              !landingConsentAccepted ||
                              !phoneLogin.phone ||
                              Boolean(phoneLoginError)
                            }
                          >
                            {phoneCodePending
                              ? english
                                ? "Signing in..."
                                : "正在登录..."
                              : english
                                ? "Enter workspace"
                                : "进入工作区"}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={continueLandingPhoneEntry}
                            disabled={
                              phoneCodePending ||
                              !landingConsentAccepted ||
                              !phoneLogin.phone ||
                              Boolean(phoneLoginError)
                            }
                          >
                            {english ? "Resend" : "重发"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <label
                    className="flex items-start gap-3 text-sm text-[color:var(--muted-foreground)]"
                    htmlFor="landing-login-consent"
                  >
                    <input
	                      id="landing-login-consent"
	                      data-testid="landing-login-consent"
	                      type="checkbox"
	                      aria-label={
	                        english
	                          ? "Agree to the user agreement"
	                          : "同意用户协议"
	                      }
	                      checked={landingConsentAccepted}
                      onChange={(event) => setLandingConsentAccepted(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[color:var(--border-strong)] text-[var(--accent)]"
                    />
                    <span>
                      {english ? "I have read and agree to the " : "已阅读并同意"}
                      <Link
                        href="/terms"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[var(--accent)] underline underline-offset-4"
                        data-testid="landing-login-consent-link"
                      >
                        {english ? "User Agreement" : "用户协议"}
                      </Link>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        aria-hidden="true"
        className="sr-only"
        data-ready={runtimeReady ? "true" : "false"}
        data-testid="login-panel-runtime-ready"
        suppressHydrationWarning
      />
      <Card className="workspace-shell-panel border shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            {inviteEntryMode ? (
              <BadgeCheck className="h-5 w-5" />
            ) : returningEntryMode ? (
              <KeyRound className="h-5 w-5" />
            ) : (
              <UserPlus2 className="h-5 w-5" />
            )}
            <p className="text-sm font-semibold">
              {inviteEntryMode
                ? english
                  ? "DingTalk invite entry"
                  : "钉钉邀请进入"
                : returningEntryMode
                  ? english
                    ? "Returning member entry"
                    : "已有成员回到工作区"
                : newTrialEntryMode
                  ? english
                    ? "New trial setup"
                    : "新试点开通"
                : compatibilityEntryMode
                  ? english
                    ? "Support entry"
                    : "受邀成员辅助入口"
                : landingMode
                ? english
                  ? "Start your operating workspace"
                  : "开始你的经营工作区"
                : english
                  ? "Formal customer entry"
                : "正式客户进入路径"}
            </p>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {inviteEntryMode
                ? english
                  ? "Confirm the invitation, then enter the workspace."
                  : "确认邀请，然后进入工作区。"
                : returningEntryMode
                  ? english
                    ? "Sign in and return to your workspace."
                    : "登录并回到你的工作区。"
                : newTrialEntryMode
                  ? english
                    ? "Verify once, then create the trial workspace."
                    : "验证一次，然后开通试点工作区。"
                : compatibilityEntryMode
                  ? english
                    ? "Continue from a support-provided invite link."
                    : "通过专用邀请链接继续。"
                : landingMode
                ? english
                  ? "Verified signup on the right, real workspace right after"
                  : "右侧现在就注册，下一步直接进入真实工作区"
                : english
                  ? "Verified signup, password login, and phone-code login"
                  : "正式验证注册、密码登录、钉钉扫码登录"}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-[color:var(--muted)]">
              {inviteEntryMode
                ? english
                  ? "Confirm your identity and set the missing login details."
                  : "确认身份，补齐缺少的登录信息。"
                : returningEntryMode
                  ? english
                    ? "Sign in with your existing identity, or use DingTalk."
                    : "用已有账号登录，或用钉钉继续。"
                : newTrialEntryMode
                  ? english
                    ? "For new trial workspaces. Existing members should sign in instead."
                    : "只服务新试点开通。已有成员请回到登录。"
                : compatibilityEntryMode
                  ? english
                    ? "Reached only from a dedicated support or invite link."
                    : "只从客服或邀请链接进入。"
                : landingMode
                ? english
                  ? "New here? Start with verified signup. Coming back? Use password or DingTalk."
                  : "新用户走正式注册；已有账号用密码或钉钉继续。"
                : english
                  ? "Verify work email and phone, set a password, you're in. Returning members use password or DingTalk."
                  : "验证工作邮箱和手机号、设置密码，就能进。已有成员可用密码或钉钉。"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {inviteEntryMode ? (
            <div
              className="grid gap-3 rounded-3xl border border-[color:var(--accent-soft)] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface)_58%)] p-4 sm:grid-cols-3"
              data-testid="invite-entry-summary"
            >
              <div className="rounded-2xl bg-[color:var(--surface)]/80 p-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "You are" : "你是谁"}
                </p>
                <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                  {inviteDisplayName || (english ? "To be confirmed" : "待确认")}
                </p>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface)]/80 p-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Joining" : "加入组织"}
                </p>
                <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                  {inviteOrganizationName || (english ? "Invited Helm workspace" : "受邀 Helm 工作区")}
                </p>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface)]/80 p-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Role" : "职位"}
                </p>
                <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                  {inviteTitle || (english ? "Member" : "成员")}
                </p>
              </div>
            </div>
          ) : landingMode ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: english ? "Verified signup" : "正式验证注册",
                  body: english
                    ? "Create a real trial organization directly from this panel."
                    : "从这里直接开一个真实试用组织，不需要先去走一次性演示。",
                },
                {
                  title: english ? "Password / DingTalk scan" : "密码 / 钉钉扫码",
                  body: english
                    ? "Returning members should use password or DingTalk scan to get back into the same workspace quickly."
                    : "已有成员优先通过密码或钉钉扫码，快速回到同一个真实工作区。",
                },
                {
                  title: english ? "Narrow compatibility path" : "窄兼容入口",
                  body: english
                    ? "Invited teammates can still continue with work email when needed."
                    : "被邀请成员仍可用工作邮箱继续进入，但这条路径继续保持窄边界。",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="workspace-panel-muted rounded-2xl border border-[color:var(--border)] px-4 py-4"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.body}</p>
                </div>
              ))}
            </div>
          ) : null}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as LoginPanelTab)}
            className="space-y-5"
          >
            {inviteEntryMode || newTrialEntryMode || compatibilityEntryMode ? null : returningEntryMode ? (
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-[color:var(--surface-subtle)] p-1">
                <TabsTrigger value="password" className="rounded-xl">
                  {english ? "Password" : "密码登录"}
                </TabsTrigger>
                <TabsTrigger value="phone" className="rounded-xl">
                  {english ? "DingTalk" : "钉钉继续"}
                </TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-2xl bg-[color:var(--surface-subtle)] p-1">
                <TabsTrigger value="signup" className="rounded-xl">
                  {english ? "Verified signup" : "正式注册"}
                </TabsTrigger>
                <TabsTrigger value="password" className="rounded-xl">
                  {english ? "Password sign-in" : "密码登录"}
                </TabsTrigger>
                <TabsTrigger value="phone" className="rounded-xl">
                  {english ? "DingTalk scan" : "钉钉扫码"}
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="signup" className="space-y-5">
              {inviteEntryMode ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="mt-0.5 h-5 w-5 text-[color:var(--accent)]" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english ? "Only two things are needed now" : "现在只需要补两件事"}
                        </p>
                        <p className="text-sm leading-6 text-[color:var(--muted)]">
                          {english
                            ? "Use your work email as the account identifier, then set a password for future sign-in. The DingTalk invite context stays attached in the background."
                            : "用工作邮箱作为账号，再设置一个以后登录用的密码。钉钉邀请上下文会在后台保留。"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <FieldLabel htmlFor="verified-trial-email">{english ? "Work email" : "工作邮箱"}</FieldLabel>
                      <Input
                        id="verified-trial-email"
                        data-testid="verified-trial-email"
                        type="email"
                        autoComplete="email"
                        value={signup.email}
                        onChange={(event) =>
                          setSignup((current) => ({ ...current, email: event.target.value }))
                        }
                        placeholder="operator@example.com"
                      />
                    </div>
                    {!signup.phone ? (
                      <div className="space-y-2 sm:col-span-2">
                        <FieldLabel htmlFor="verified-trial-phone">{english ? "Phone number" : "手机号"}</FieldLabel>
                        <Input
                          id="verified-trial-phone"
                          data-testid="verified-trial-phone"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={CHINA_PHONE_INPUT_MAX_LENGTH}
                          value={signup.phone}
                          onChange={(event) =>
                            setSignup((current) => ({
                              ...current,
                              phone: sanitizeChinaPhoneInput(event.target.value),
                            }))
                          }
                          placeholder={english ? "13800000000" : "13800000000"}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <FieldLabel htmlFor="verified-trial-password">{english ? "Set password" : "设置密码"}</FieldLabel>
                      <Input
                        id="verified-trial-password"
                        data-testid="verified-trial-password"
                        type="password"
                        autoComplete="new-password"
                        value={signup.password}
                        onChange={(event) =>
                          setSignup((current) => ({ ...current, password: event.target.value }))
                        }
                        placeholder={english ? "At least 8 characters" : "至少 8 位，包含字母和数字"}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="verified-trial-confirm-password">
                        {english ? "Confirm password" : "确认密码"}
                      </FieldLabel>
                      <Input
                        id="verified-trial-confirm-password"
                        data-testid="verified-trial-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={signup.confirmPassword}
                        onChange={(event) =>
                          setSignup((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                        placeholder={english ? "Repeat the password" : "再次输入密码"}
                      />
                    </div>
                  </div>

                  <details className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Identity looks wrong?" : "身份信息不对？"}
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="verified-trial-name">{english ? "Your name" : "你的姓名"}</FieldLabel>
                        <Input
                          id="verified-trial-name"
                          data-testid="verified-trial-name"
                          value={signup.name}
                          onChange={(event) =>
                            setSignup((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder={english ? "Zhang San" : "张正式"}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="verified-trial-organization">
                          {english ? "Organization name" : "组织名称"}
                        </FieldLabel>
                        <Input
                          id="verified-trial-organization"
                          data-testid="verified-trial-organization"
                          value={signup.organizationName}
                          onChange={(event) =>
                            setSignup((current) => ({
                              ...current,
                              organizationName: event.target.value,
                            }))
                          }
                          placeholder={english ? "Helm China Team" : "Helm 中国团队"}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="verified-trial-title">{english ? "Role / title" : "岗位 / 职位"}</FieldLabel>
                        <Input
                          id="verified-trial-title"
                          data-testid="verified-trial-title"
                          value={signup.title}
                          onChange={(event) =>
                            setSignup((current) => ({ ...current, title: event.target.value }))
                          }
                          placeholder={english ? "Risk Strategy Specialist" : "风控策略专家"}
                        />
                      </div>
                      {signup.phone ? (
                        <div className="space-y-2">
                          <FieldLabel htmlFor="verified-trial-phone">{english ? "Phone number" : "手机号"}</FieldLabel>
                          <Input
                            id="verified-trial-phone"
                            data-testid="verified-trial-phone"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            maxLength={CHINA_PHONE_INPUT_MAX_LENGTH}
                            value={signup.phone}
                            onChange={(event) =>
                              setSignup((current) => ({
                                ...current,
                                phone: sanitizeChinaPhoneInput(event.target.value),
                              }))
                            }
                            placeholder={english ? "13800000000" : "13800000000"}
                          />
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-name">{english ? "Your name" : "你的姓名"}</FieldLabel>
                    <Input
                      id="verified-trial-name"
                      data-testid="verified-trial-name"
                      value={signup.name}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder={english ? "Zhang San" : "张正式"}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-organization">
                      {english ? "Organization name" : "组织名称"}
                    </FieldLabel>
                    <Input
                      id="verified-trial-organization"
                      data-testid="verified-trial-organization"
                      value={signup.organizationName}
                      onChange={(event) =>
                        setSignup((current) => ({
                          ...current,
                          organizationName: event.target.value,
                        }))
                      }
                      placeholder={english ? "Helm China Team" : "Helm 中国团队"}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-title">{english ? "Role / title" : "岗位 / 职位"}</FieldLabel>
                    <Input
                      id="verified-trial-title"
                      data-testid="verified-trial-title"
                      value={signup.title}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder={english ? "Risk Strategy Specialist" : "风控策略专家"}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-email">{english ? "Work email" : "工作邮箱"}</FieldLabel>
                    <Input
                      id="verified-trial-email"
                      data-testid="verified-trial-email"
                      type="email"
                      value={signup.email}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="team@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-phone">{english ? "Phone number" : "手机号"}</FieldLabel>
                    <div className="min-h-5">
                      {signupPhoneError ? (
                        <p className="text-sm text-[color:var(--accent-warm)]" data-testid="verified-trial-phone-error">
                          {signupPhoneError}
                        </p>
                      ) : null}
                    </div>
                    <Input
                      id="verified-trial-phone"
                      data-testid="verified-trial-phone"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={CHINA_PHONE_INPUT_MAX_LENGTH}
                      value={signup.phone}
                      onChange={(event) =>
                        setSignup((current) => ({
                          ...current,
                          phone: sanitizeChinaPhoneInput(event.target.value),
                        }))
                      }
                      placeholder={english ? "13800000000" : "13800000000"}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-password">{english ? "Password" : "设置密码"}</FieldLabel>
                    <Input
                      id="verified-trial-password"
                      data-testid="verified-trial-password"
                      type="password"
                      value={signup.password}
                      onChange={(event) =>
                        setSignup((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder={english ? "At least 8 characters" : "至少 8 位，包含字母和数字"}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="verified-trial-confirm-password">
                      {english ? "Confirm password" : "确认密码"}
                    </FieldLabel>
                    <Input
                      id="verified-trial-confirm-password"
                      data-testid="verified-trial-confirm-password"
                      type="password"
                      value={signup.confirmPassword}
                      onChange={(event) =>
                        setSignup((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      placeholder={english ? "Repeat the password" : "再次输入密码"}
                    />
                  </div>
                </div>
              )}

              <div className="workspace-panel-muted rounded-2xl border border-dashed p-4 text-sm leading-6 text-[color:var(--muted)]">
                <p className="font-medium text-[color:var(--foreground)]">
                  {inviteEntryMode
                    ? english
                      ? "What happens after this step"
                      : "这一步之后会发生什么"
                    : english ? "What you get immediately after signup" : "注册完成后，你马上会得到什么"}
                </p>
                <p className="mt-2">
                  {inviteEntryMode
                    ? english
                      ? "Helm will attach this account to the invited organization. If verification is already covered by DingTalk, you will enter the workspace directly; otherwise Helm will ask only for the missing verification code."
                      : "Helm 会把这个账号接到受邀组织里。如果钉钉身份已覆盖验证，会直接进入工作区；如果还缺验证，只补缺的验证码。"
                    : english
                      ? "A verified account, a real organization workspace, a team owner seat, a live trial environment, and the setup flow needed to bring teammates in."
                      : "一个已验证账号、一个真实组织工作区、一个团队主账号身份、可直接使用的试用环境，以及把团队带进来的初始化路径。"}
                </p>
              </div>

              <Button
                className="w-full"
                data-testid="verified-trial-start"
                onClick={startSignup}
                disabled={signupPending || completePending || !signup.phone || Boolean(signupPhoneError)}
              >
                {signupPending
                  ? english
                    ? "Preparing verification..."
                    : "正在准备验证..."
                  : inviteEntryMode
                    ? english
                      ? "Confirm identity and join workspace"
                      : "确认身份并加入组织"
                    : english
                    ? "Start verified trial"
                    : "开始正式验证试用"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {signupVerification ? (
                <div className="space-y-4 rounded-3xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 p-5">
                  <div className="flex items-start gap-3">
                    <MailCheck className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {signupVerification.requiresVerificationCodes
                          ? english
                            ? "Complete both verifications before workspace creation"
                            : "先完成邮箱和手机号双验证，再创建工作区"
                          : english
                            ? "DingTalk authorization confirmed. Complete profile and continue."
                            : "钉钉授权已确认，补全信息后直接继续。"}
                      </p>
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {signupVerification.requiresVerificationCodes
                          ? verificationBoundaryNote
                          : english
                            ? "Email and phone already match the authorized DingTalk identity in this invite flow."
                            : "当前邀请流程里，邮箱和手机号已与钉钉授权身份一致，无需再次验证码验证。"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="workspace-panel rounded-2xl border p-4">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english ? "Email preview" : "邮箱预览"}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{signupVerification.preview.email}</p>
                      <p
                        className="mt-3 text-base font-semibold text-[color:var(--foreground)]"
                        data-testid="signup-email-code-preview"
                      >
                        {signupVerification.preview.emailCode
                          ? `${english ? "Email code" : "邮箱验证码"}: ${signupVerification.preview.emailCode}`
                          : english
                            ? "Email code sent. Check your inbox."
                            : "邮箱验证码已发送，请查收邮箱。"}
                      </p>
                    </div>
                    <div className="workspace-panel rounded-2xl border p-4">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english ? "Phone preview" : "手机预览"}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{signupVerification.preview.phone}</p>
                      <p
                        className="mt-3 text-base font-semibold text-[color:var(--foreground)]"
                        data-testid="signup-phone-code-preview"
                      >
                        {english ? "Phone code" : "手机验证码"}:{" "}
                        {signupVerification.preview.phoneCode ?? "--"}
                      </p>
                    </div>
                  </div>

                  {signupVerification.requiresVerificationCodes ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="verified-trial-email-code">
                          {english ? "Email code" : "邮箱验证码"}
                        </FieldLabel>
                        <Input
                          id="verified-trial-email-code"
                          data-testid="verified-trial-email-code"
                          inputMode="numeric"
                          value={signupCodes.emailCode}
                          onChange={(event) =>
                            setSignupCodes((current) => ({
                              ...current,
                              emailCode: event.target.value,
                            }))
                          }
                          placeholder="123456"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="verified-trial-phone-code">
                          {english ? "Phone code" : "手机验证码"}
                        </FieldLabel>
                        <Input
                          id="verified-trial-phone-code"
                          data-testid="verified-trial-phone-code"
                          inputMode="numeric"
                          value={signupCodes.phoneCode}
                          onChange={(event) =>
                            setSignupCodes((current) => ({
                              ...current,
                              phoneCode: event.target.value,
                            }))
                          }
                          placeholder="123456"
                        />
                      </div>
                    </div>
                  ) : null}

                  <Button
                    className="w-full"
                    data-testid="verified-trial-complete"
                    onClick={completeSignup}
                    disabled={completePending || signupPending}
                  >
                    {completePending
                      ? english
                        ? "Verifying and creating workspace..."
                        : "正在验证并创建工作区..."
                      : signupVerification.requiresVerificationCodes
                        ? english
                          ? "Complete verification and enter setup"
                          : "完成验证并进入初始化"
                        : inviteEntryMode
                          ? english
                            ? "Enter invited workspace"
                            : "进入受邀工作区"
                        : english
                          ? "Complete profile and enter setup"
                          : "完成信息并进入初始化"}
                  </Button>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="password" className="space-y-5">
              <div className="space-y-2">
                <FieldLabel htmlFor="password-login-identifier">
                  {english ? "Work email or phone" : "工作邮箱或手机号"}
                </FieldLabel>
                <Input
                  id="password-login-identifier"
                  data-testid="password-login-identifier"
                  value={passwordLogin.identifier}
                  onChange={(event) =>
                    setPasswordLogin((current) => ({
                      ...current,
                      identifier: event.target.value,
                    }))
                  }
                  placeholder={english ? "team@company.com or +86 138..." : "team@company.com 或 13800000000"}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="password-login-password">{english ? "Password" : "密码"}</FieldLabel>
                <Input
                  id="password-login-password"
                  data-testid="password-login-password"
                  type="password"
                  value={passwordLogin.password}
                  onChange={(event) =>
                    setPasswordLogin((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={english ? "Enter your password" : "输入你设置的密码"}
                />
              </div>
              <Button
                className="w-full"
                data-testid="password-login-submit"
                onClick={loginWithPassword}
                disabled={passwordPending}
              >
                <KeyRound className="h-4 w-4" />
                {passwordPending
                  ? english
                    ? "Signing in..."
                    : "正在登录..."
                  : english
                    ? "Sign in with password"
                    : "使用密码登录"}
              </Button>
            </TabsContent>

            <TabsContent value="phone" className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Scan with DingTalk to continue" : "使用钉钉扫码继续登录"}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted)]">
                  {english
                    ? "This keeps returning-member re-entry explicit and review-first, without SMS code entry."
                    : "该入口保留显式、受控的成员回流路径，不再要求输入手机验证码。"}
                </p>
              </div>
              <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                <PublicSsoPanel locale={locale} options={resolvedPublicSsoOptions} />
              </div>
              <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                {english
                  ? "If DingTalk OAuth is not configured yet, this panel will show the pending state."
                  : "如果钉钉 OAuth 还未配置，这里会显示待配置状态。"}
              </p>
            </TabsContent>
          </Tabs>

          {inviteEntryMode ? (
            <details
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
              data-testid="invite-entry-other-options"
            >
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "This is not you?" : "这不是你的身份？"}
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--muted)]">
                <p>
                  {english
                    ? "Do not continue this invitation if the organization or role is wrong. Ask the inviter to resend it, or use an existing account sign-in path."
                    : "如果组织或职位不对，不要继续这个邀请。请让邀请人重发，或改用已有账号登录。"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <Link href="/login?tab=password">
                      {english ? "Use existing account" : "使用已有账号登录"}
                    </Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/login?tab=phone">
                      {english ? "Scan DingTalk again" : "重新钉钉扫码"}
                    </Link>
                  </Button>
                </div>
              </div>
            </details>
          ) : landingMode || compatibilityEntryMode ? (
            <>
              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {landingMode
                      ? english
                        ? "Already invited by your team?"
                        : "已经被团队邀请加入？"
                      : english
                        ? "Compatibility path for invited or legacy pilot users"
                        : "被邀请成员 / 旧试点账号的兼容入口"}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">
                    {landingMode
                      ? english
                        ? "If your organization already invited your work email, you can continue directly from here."
                        : "如果你的组织已经邀请了你的工作邮箱，可以直接从这里继续进入。"
                      : english
                        ? "Keep this narrow path so already-invited teammates can continue with work email before they finish formal phone and password enrollment."
                        : "保留这条窄兼容路径，让已经被邀请的成员在补齐手机号和密码前，仍然可以先用工作邮箱进入组织。"}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Input
                    data-testid="public-login-email"
                    type="email"
                    value={compatibilityEmail}
                    onChange={(event) => setCompatibilityEmail(event.target.value)}
                    placeholder={english ? "member@company.com" : "member@company.com"}
                  />
                  <Button
                    variant="secondary"
                    data-testid="public-login-submit"
                    onClick={continueWithWorkEmail}
                    disabled={compatibilityPending}
                  >
                    {compatibilityPending
                      ? english
                        ? "Continuing..."
                        : "正在继续..."
                      : english
                        ? "Continue with work email"
                        : "使用工作邮箱继续"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {!landingMode &&
          !inviteEntryMode &&
          !newTrialEntryMode &&
          !returningEntryMode &&
          !compatibilityEntryMode ? (
            <>
              <Separator />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
                <WorkspaceGuidancePanel
                  eyebrow={english ? "Identity guidance" : "身份引导"}
                  title={
                    english
                      ? "Keep signup, sign-in and compatibility entry on one narrow identity chain."
                      : "把注册、登录和兼容入口收紧到同一条窄身份链上。"
                  }
                  summary={
                    english
                      ? "Pick the path that fits your state now. Why that path, and what still stays review-first, is one click away."
                      : "选择符合你当前状态的路径。为什么是这条、哪些仍保持审核优先，下一步即可见。"
                  }
                  recommendations={loginGuidanceRecommendations}
                  reminders={loginGuidanceReminders}
                  boundary={
                    english
                      ? "Authentication here opens the right workspace path, but it still does not imply broader org or execution authority."
                      : "这里的认证只负责把用户带进正确的工作区路径，不意味着更大的组织权限或执行权限。"
                  }
                  recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
                  remindersLabel={english ? "Context reminders" : "上下文提醒"}
                  boundaryLabel={english ? "Boundary" : "边界"}
                />
                <WorkspaceFormAssistPanel
                  eyebrow={english ? "Entry assist" : "入口辅助"}
                  title={
                    english
                      ? "Use assist to shorten typing, not to replace identity review."
                      : "辅助层只用来减少输入，不替代身份复核。"
                  }
                  summary={
                    english
                      ? "The highest-value assist on this page is contextual autofill and path switching. Submission and identity checks still stay explicit."
                      : "这个页面最有价值的辅助是上下文填充和路径切换；提交与身份校验仍然保持显式。"
                  }
                  bullets={[
                    english
                      ? `Current path: ${activeTab === "signup" ? "verified signup" : activeTab === "password" ? "password sign-in" : "DingTalk scan"}`
                      : `当前路径：${activeTab === "signup" ? "正式注册" : activeTab === "password" ? "密码登录" : "钉钉扫码"}`,
                    english
                      ? "Compatibility entry should stay as a fallback for invited or legacy pilot members."
                      : "兼容入口继续只做被邀请成员和旧试点成员的兜底入口。",
                    english
                      ? "Signup email uses system delivery when configured; preview remains as controlled fallback."
                      : "注册邮箱在配置后走系统投递，验证码预览继续作为受控回退。",
                  ]}
                  actions={loginAssistActions}
                  boundary={
                    english
                      ? "Assist can prefill fields or switch tabs, but it does not submit any identity action automatically."
                      : "辅助层可以填字段、切路径，但不会自动提交任何身份动作。"
                  }
                />
              </div>
            </>
          ) : null}

        </CardContent>
      </Card>
    </div>
  );
}

function inferOrganizationNameFromEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    return "";
  }

  const domain = normalizedEmail.split("@")[1]?.split(".")[0] ?? "";
  if (!domain) {
    return "";
  }

  return domain
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
