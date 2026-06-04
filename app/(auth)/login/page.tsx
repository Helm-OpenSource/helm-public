import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { LoginReturningEntryCard } from "@/components/auth/login-returning-entry-card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { Button } from "@/components/ui/button";
import { LoginPanel } from "@/features/auth/login-panel";
import { readPublicOauthSignupPrefillCookie, PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE } from "@/lib/auth/public-oauth";
import { isDingTalkOauthConfigured } from "@/lib/connectors/dingtalk";
import { isFeishuOauthConfigured } from "@/lib/connectors/feishu";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveUiLocale } from "@/lib/i18n/config";

type LoginPageSearchParams = Record<string, string | string[] | undefined>;
type LoginPageEntryMode =
  | "dingtalk-invite"
  | "new-trial"
  | "phone-return"
  | "compatibility"
  | "returning";
type LoginPanelEntryIntent = Exclude<LoginPageEntryMode, "phone-return">;

function readSearchParam(
  params: LoginPageSearchParams | undefined,
  key: string,
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildPublicAuthStartPath(
  provider: "dingtalk" | "feishu",
  params: {
    organizationName?: string;
    workspaceId?: string;
    title?: string;
  },
) {
  const searchParams = new URLSearchParams();

  if (params.organizationName?.trim()) {
    searchParams.set("org", params.organizationName.trim());
  }

  if (params.workspaceId?.trim()) {
    searchParams.set("ws", params.workspaceId.trim());
  }

  if (params.title?.trim()) {
    searchParams.set("title", params.title.trim());
  }

  const query = searchParams.toString();
  return `/api/public-auth/${provider}/start${query ? `?${query}` : ""}`;
}

function getLoginPageCopy(
  mode: LoginPageEntryMode,
  english: boolean,
  organizationName?: string,
) {
  switch (mode) {
    case "dingtalk-invite":
      return {
        eyebrow: english ? "DingTalk invite recognized" : "钉钉邀请已识别",
        title: english
          ? `Confirm your invitation${organizationName ? ` to ${organizationName}` : ""}.`
          : `确认加入${organizationName ? `「${organizationName}」` : "你的Helm组织"}。`,
        description: english
          ? "Helm already knows who invited you and which organization you are joining. Confirm the identity below and set your login password."
          : "Helm已经知道你是谁、要加入哪个组织。确认身份，补齐工作邮箱和密码即可进入。",
      };
    case "new-trial":
      return {
        eyebrow: english ? "New trial setup" : "新试点开通",
        title: english ? "Create your Helm trial workspace." : "开通你的Helm试点工作区。",
        description: english
          ? "Verify your work email and phone, set a password, and Helm will create the trial workspace in one path."
          : "验证工作邮箱和手机号，设置密码，然后直接创建试点工作区。",
      };
    case "phone-return":
      return {
        eyebrow: english ? "Phone verification sign-in" : "手机号验证登录",
        title: english ? "Use your phone to get back in." : "用手机号回到工作区。",
        description: english
          ? "Enter the phone number already attached to your account. Helm will send a code and return you to the right workspace."
          : "输入已绑定账号的手机号，获取验证码后直接回到对应工作区。",
      };
    case "compatibility":
      return {
        eyebrow: english ? "Invite support entry" : "邀请辅助入口",
        title: english ? "Continue from your invite link." : "从邀请链接继续。",
        description: english
          ? "This path is only for a dedicated invite or support link. If you already have a password, use normal sign-in."
          : "这条路径只服务专用邀请或客服链接。已有密码的成员请使用正常登录。",
      };
    case "returning":
      return {
        eyebrow: english ? "Workspace sign-in" : "工作区登录",
        title: english ? "Return to your Helm workspace." : "回到你的Helm工作区。",
        description: english
          ? "Use your email, phone, DingTalk, or Feishu to continue."
          : "使用邮箱、手机号、钉钉或飞书继续。",
      };
  }
}

function getInvitationNextSteps(english: boolean) {
  return english
    ? [
        "Open today's operating moves",
        "Review customer follow-up drafts",
        "Submit a customer, meeting, delivery, commitment, or blocker signal",
      ]
    : [
        "查看今日必须推进事项",
        "复核客户跟进建议",
        "上报客户、会议、交付、承诺或阻塞信号",
      ];
}

function LoginInvitationOrientationCard({
  english,
  organizationName,
  title,
}: {
  english: boolean;
  organizationName?: string;
  title?: string;
}) {
  const organizationLabel =
    organizationName?.trim() || (english ? "your Helm organization" : "你的Helm组织");
  const titleLabel = title?.trim() || (english ? "member" : "成员");
  const steps = getInvitationNextSteps(english);

  return (
    <div
      data-testid="login-invitation-orientation"
      className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--status-success-text)]">
          {english ? "Identity recognized" : "已识别身份"}
        </span>
        <span className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">
          {english ? `Role: ${titleLabel}` : `身份：${titleLabel}`}
        </span>
      </div>
      <p className="mt-4 text-base font-semibold text-[color:var(--foreground)]">
        {english
          ? `You are joining ${organizationLabel}.`
          : `你正在加入「${organizationLabel}」。`}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {english
          ? "After you confirm, you'll land straight on the surface that matches your role. No extra picks, no extra config."
          : "确认后直接进入你的角色页面。不需要再做额外选择或配置。"}
      </p>
      <p className="mt-4 text-sm font-semibold text-[color:var(--foreground)]">
        {english ? "First 3 things to do inside:" : "进入后先做这 3 件事："}
      </p>
      <div className="mt-2 grid gap-2">
        {steps.map((step) => (
          <div key={step} className="flex items-start gap-2 text-sm text-[color:var(--foreground)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--status-success-text)]" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<LoginPageSearchParams>;
}) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const params = (await searchParams) ?? {};
  const requestedTab = readSearchParam(params, "tab");
  const provider = readSearchParam(params, "provider");
  const prefillMarker = readSearchParam(params, "prefill") === "1";
  const oauthStatus = readSearchParam(params, "status");
  const compatibilityEmail = readSearchParam(params, "compat_email");
  const autoCompatibility = readSearchParam(params, "auto_compat") === "1";
  const publicOauthOrganizationName = readSearchParam(params, "org");
  const publicOauthWorkspaceId = readSearchParam(params, "ws");
  const publicOauthTitle = readSearchParam(params, "title");
  const initialTab =
    requestedTab === "signup" || requestedTab === "password" || requestedTab === "phone"
      ? requestedTab
      : undefined;
  const publicSsoOptions = [
    {
      provider: "dingtalk" as const,
      ready: isDingTalkOauthConfigured(),
      startUrl: buildPublicAuthStartPath("dingtalk", {
        organizationName: publicOauthOrganizationName,
        workspaceId: publicOauthWorkspaceId,
        title: publicOauthTitle,
      }),
    },
    {
      provider: "feishu" as const,
      ready: isFeishuOauthConfigured(),
      startUrl: buildPublicAuthStartPath("feishu", {
        organizationName: publicOauthOrganizationName,
        workspaceId: publicOauthWorkspaceId,
        title: publicOauthTitle,
      }),
    },
  ];
  const phonePrefill = readSearchParam(params, "phone");
  const oauthPrefill =
    prefillMarker && provider
      ? readPublicOauthSignupPrefillCookie(
          cookieStore.get(PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE)?.value ?? null,
        )
      : null;
  const signupPrefillName =
    oauthPrefill && oauthPrefill.provider === provider ? oauthPrefill.name ?? undefined : undefined;
  const signupPrefillEmail =
    oauthPrefill && oauthPrefill.provider === provider ? oauthPrefill.email ?? undefined : undefined;
  const signupPrefillPhone =
    phonePrefill ??
    (oauthPrefill && oauthPrefill.provider === provider
      ? oauthPrefill.phone ?? undefined
      : undefined);
  const signupPrefillOrganizationName =
    oauthPrefill && oauthPrefill.provider === provider
      ? oauthPrefill.organizationName ?? undefined
      : undefined;
  const signupPrefillTitle =
    oauthPrefill && oauthPrefill.provider === provider ? oauthPrefill.title ?? undefined : undefined;
  const isDingTalkInvitePrefill =
    provider === "dingtalk" &&
    Boolean(
      oauthPrefill &&
        oauthPrefill.provider === provider &&
        (oauthPrefill.invitedWorkspaceId ||
          oauthPrefill.organizationName ||
          oauthPrefill.title),
    );
  const oauthFallbackMessage =
    oauthStatus === "identity-conflict"
      ? english
        ? "DingTalk returned conflicting email and phone identities. Continue with manual sign in."
        : "钉钉返回的邮箱和手机号命中了不同账号，请改用手动登录继续。"
      : oauthStatus === "missing-identity"
        ? english
          ? "DingTalk did not return a usable work email or phone. Continue with manual sign in."
          : "钉钉未返回可用的工作邮箱或手机号，请改用手动登录继续。"
        : oauthStatus === "oauth-error" || oauthStatus === "failure"
          ? english
            ? "DingTalk sign in could not be completed. Continue with manual sign in."
            : "钉钉登录未完成，请改用手动登录继续。"
        : null;
  const isSignupEntry =
    !isDingTalkInvitePrefill &&
    (requestedTab === "signup" || Boolean(phonePrefill) || Boolean(oauthPrefill));
  const isPhoneCodeReturn =
    !isDingTalkInvitePrefill &&
    !isSignupEntry &&
    requestedTab === "phone" &&
    !compatibilityEmail &&
    !autoCompatibility;
  const isCompatibilityEntry =
    !isDingTalkInvitePrefill &&
    !isSignupEntry &&
    !isPhoneCodeReturn &&
    (Boolean(compatibilityEmail) || autoCompatibility);
  const entryMode: LoginPageEntryMode = isDingTalkInvitePrefill
    ? "dingtalk-invite"
    : isSignupEntry
      ? "new-trial"
      : isPhoneCodeReturn
        ? "phone-return"
        : isCompatibilityEntry
          ? "compatibility"
          : "returning";
  const loginPanelEntryIntent: LoginPanelEntryIntent =
    entryMode === "phone-return" ? "returning" : entryMode;
  const loginCopy = getLoginPageCopy(
    entryMode,
    english,
    signupPrefillOrganizationName,
  );

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1080px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[18rem] text-xs text-[color:var(--muted-foreground)]">
            {english ? "Welcome back. Today's calls are waiting." : "欢迎回来。今天要拍板的事在等你。"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/" data-testid="login-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to home" : "返回首页"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center gap-8 px-6 pb-16 pt-4 lg:px-10">
        <section className="space-y-3 text-center sm:text-left">
          <p className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--accent)]">
            {loginCopy.eyebrow}
          </p>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {loginCopy.title}
          </h1>
          <p className="text-sm leading-6 text-[color:var(--muted)]">
            {entryMode === "returning" ? (
              <>
                {loginCopy.description} {english ? "First time here? " : "第一次来？"}
                <Link
                  href="/trial"
                  className="font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                  data-testid="login-link-trial"
                >
                  {english ? "Apply for Helm Cloud trial." : "申请Helm Cloud试用。"}
                </Link>
              </>
            ) : (
              loginCopy.description
            )}
          </p>
        </section>

        {oauthFallbackMessage && (
          <div
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--status-warning-bg)] p-4 text-sm text-[color:var(--status-warning-text)]"
            data-testid="public-oauth-fallback-notice"
          >
            {oauthFallbackMessage}
          </div>
        )}

        <section className="space-y-4">
          {entryMode === "dingtalk-invite" ? (
            <LoginInvitationOrientationCard
              english={english}
              organizationName={signupPrefillOrganizationName}
              title={signupPrefillTitle}
            />
          ) : null}
          {isPhoneCodeReturn ? null : (
            <LoginPanel
              locale={locale}
              initialTab={initialTab}
              prefillSignup={{
                name: signupPrefillName,
                email: signupPrefillEmail,
                phone: signupPrefillPhone,
                organizationName: signupPrefillOrganizationName,
                title: signupPrefillTitle,
              }}
              prefillCompatibilityEmail={compatibilityEmail}
              autoContinueCompatibility={autoCompatibility}
              publicSsoOptions={publicSsoOptions}
              entryIntent={loginPanelEntryIntent}
            />
          )}
          {isPhoneCodeReturn ? (
            <LoginReturningEntryCard
              locale={locale}
              defaultExpanded
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
