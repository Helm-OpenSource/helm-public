import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cloud,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import type {
  DeploymentEntryConfig,
  DeploymentEntryProfile,
} from "@/lib/auth/deployment-entry";
import type { UiLocale } from "@/lib/i18n/config";
import cloudOperationsImage from "@/public/entry/cloud-operations.webp";
import tenantOperationsImage from "@/public/entry/tenant-operations.webp";

type EntryHomeCopy = {
  category: string;
  headline: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  secondaryHref: string;
  image: StaticImageData;
  imageAlt: string;
  assurance: string;
  checkpoints: Array<{
    title: string;
    body: string;
  }>;
};

const entryHeroStyle = {
  "--entry-hero-ink": "#171717",
  "--entry-hero-muted": "#404040",
  "--entry-hero-surface": "rgba(255, 255, 255, 0.9)",
  "--entry-hero-accent": "#047857",
  "--entry-hero-warning": "#b45309",
} as CSSProperties;

function getEntryHomeCopy(
  profile: Exclude<DeploymentEntryProfile, "public" | "first-party">,
  locale: UiLocale,
  signupEnabled: boolean,
): EntryHomeCopy {
  const english = locale === "en-US";

  if (profile === "cloud") {
    return {
      category: english ? "Hosted operating workspace" : "托管经营工作区",
      headline: english
        ? "Decisions, reviews, and evidence in one operating workspace."
        : "把判断、复核与证据放进同一个经营工作区。",
      description: english
        ? "Sign in to continue your work, or start a governed workspace with a verified identity."
        : "已有成员直接继续工作；新团队先完成身份验证，再开通受治理的工作区。",
      primaryAction: english ? "Sign in to workspace" : "登录工作区",
      secondaryAction: signupEnabled
        ? english
          ? "Start a workspace"
          : "开通工作区"
        : english
          ? "View open-source Core"
          : "查看开源 Core",
      secondaryHref: signupEnabled
        ? "/login?tab=signup"
        : "https://github.com/Helm-OpenSource/helm-public",
      image: cloudOperationsImage,
      imageAlt: english
        ? "A decision room with an operating timeline"
        : "带有经营时间线的决策工作室",
      assurance: english
        ? "Identity verified before workspace access"
        : "先验证身份，再进入工作区",
      checkpoints: [
        {
          title: english ? "Return to today's work" : "回到今日工作",
          body: english
            ? "Resume the workspace attached to your verified membership."
            : "按已验证成员关系，回到对应工作区。",
        },
        {
          title: english ? "Review before action" : "行动前先复核",
          body: english
            ? "Recommendations stay review-first and do not expand authority."
            : "建议保持复核优先，不自动扩大执行权限。",
        },
        {
          title: english ? "Keep evidence attached" : "证据随判断留存",
          body: english
            ? "Decisions, boundaries, and receipts remain traceable."
            : "判断、边界与回执保持可追踪。",
        },
      ],
    };
  }

  return {
    category: english ? "Dedicated tenant workspace" : "专属租户工作区",
    headline: english
      ? "Enter the operating surface assigned to your role."
      : "进入与你角色匹配的经营作业面。",
    description: english
      ? "This is an invite-only deployment. Your identity and tenant membership are checked before any workspace route becomes available."
      : "这是仅限受邀成员的专属部署。系统会先核验身份和租户成员关系，再开放工作区路由。",
    primaryAction: english ? "Enter workspace" : "进入工作台",
    secondaryAction: english ? "Review access boundary" : "查看访问边界",
    secondaryHref: "/terms",
    image: tenantOperationsImage,
    imageAlt: english
      ? "A service operations team reviewing a governed workflow"
      : "服务运营团队复核受治理流程",
    assurance: english
      ? "Invite-only · tenant membership enforced"
      : "仅限受邀 · 强制租户成员校验",
    checkpoints: [
      {
        title: english ? "Use an existing identity" : "使用已有身份",
        body: english
          ? "Password, phone, or configured enterprise sign-in."
          : "支持密码、手机号或已配置的企业身份登录。",
      },
      {
        title: english ? "Stay inside this tenant" : "只进入本租户",
        body: english
          ? "Memberships outside this deployment are never offered."
          : "不会展示或进入当前部署之外的成员关系。",
      },
      {
        title: english ? "Land on the role surface" : "直达角色作业面",
        body: english
          ? "Successful sign-in routes to the deployment home."
          : "登录成功后直接进入本部署首页。",
      },
    ],
  };
}

function EntryProfileIcon({
  profile,
}: {
  profile: Exclude<DeploymentEntryProfile, "public">;
}) {
  if (profile === "cloud") {
    return <Cloud className="h-5 w-5" />;
  }
  if (profile === "tenant") {
    return <Building2 className="h-5 w-5" />;
  }
  return <Fingerprint className="h-5 w-5" />;
}

function FirstPartyEntryHome({
  config,
  locale,
  databaseAvailable,
}: {
  config: DeploymentEntryConfig;
  locale: UiLocale;
  databaseAvailable: boolean;
}) {
  const english = locale === "en-US";
  const companyName = config.companyName ?? config.displayName;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex h-20 w-full max-w-[1120px] items-center justify-between px-6 lg:px-10">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label={`${config.displayName} ${english ? "home" : "首页"}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
              <Fingerprint className="h-5 w-5" />
            </span>
            <span className="truncate text-base font-semibold">
              {config.displayName}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <PublicLocaleSwitcher locale={locale} variant="compact" />
            <ThemeToggle locale={locale} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center px-6 py-14 lg:px-10">
        <div className="h-1 w-12 bg-[color:var(--accent)]" aria-hidden />
        <p className="mt-6 text-sm font-semibold text-[color:var(--accent)]">
          {english ? "Private company workspace" : "公司内部专属入口"}
        </p>
        <h1 className="mt-4 max-w-[820px] text-pretty text-4xl font-semibold leading-[1.12] sm:text-5xl lg:text-6xl">
          {companyName}
        </h1>
        <p className="mt-6 text-xl font-semibold">
          {english ? "Helm internal workspace" : "Helm 内部工作台"}
        </p>
        <p className="mt-3 max-w-[560px] text-sm leading-7 text-[color:var(--muted)] sm:text-base">
          {english
            ? "Authorized employees can sign in with an existing company identity. Access remains limited to this internal workspace."
            : "仅限已授权员工使用现有公司身份登录，访问范围严格限定在内部工作区。"}
        </p>

        <div className="mt-10">
          <Button asChild size="lg" className="h-12 rounded-md px-6">
            <Link href="/login" data-testid="deployment-entry-login">
              <LockKeyhole className="mr-2 h-4 w-4" />
              {english ? "Sign in" : "登录"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[color:var(--muted)]">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[color:var(--accent)]" />
            {english ? "Authorized members only" : "仅限授权成员"}
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                databaseAvailable
                  ? "bg-[color:var(--status-success-text)]"
                  : "bg-[color:var(--status-warning-text)]"
              }`}
            />
            {databaseAvailable
              ? english
                ? "Identity service available"
                : "身份服务可用"
              : english
                ? "Identity service reconnecting"
                : "身份服务正在重连"}
          </span>
        </div>
      </main>

      <footer className="border-t border-[color:var(--border)]">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-6 py-5 text-xs text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span>{companyName}</span>
          <nav className="flex items-center gap-5" aria-label={english ? "Legal" : "法律信息"}>
            <Link href="/terms" className="hover:text-[color:var(--foreground)]">
              {english ? "Terms" : "服务条款"}
            </Link>
            <Link href="/privacy" className="hover:text-[color:var(--foreground)]">
              {english ? "Privacy" : "隐私政策"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function DeploymentEntryHome({
  config,
  locale,
  databaseAvailable,
}: {
  config: DeploymentEntryConfig;
  locale: UiLocale;
  databaseAvailable: boolean;
}) {
  if (config.profile === "public") {
    return null;
  }

  const english = locale === "en-US";

  if (!config.configurationValid) {
    return (
      <main className="flex min-h-screen items-center bg-[color:var(--background)] px-6 text-[color:var(--foreground)]">
        <section className="mx-auto w-full max-w-xl border-l-4 border-[color:var(--status-danger-text)] pl-6">
          <LockKeyhole className="h-8 w-8 text-[color:var(--status-danger-text)]" />
          <h1 className="mt-5 text-3xl font-semibold">
            {english
              ? "Deployment entry is not configured."
              : "部署入口尚未正确配置。"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
            {english
              ? "A private deployment must declare at least one allowed workspace slug or system key. Access stays closed until the configuration is corrected."
              : "私有部署必须声明至少一个允许的工作区 slug 或 system key。配置修正前，入口保持关闭。"}
          </p>
        </section>
      </main>
    );
  }

  if (config.profile === "first-party") {
    return (
      <FirstPartyEntryHome
        config={config}
        locale={locale}
        databaseAvailable={databaseAvailable}
      />
    );
  }

  const copy = getEntryHomeCopy(
    config.profile,
    locale,
    config.selfServeSignupEnabled,
  );

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <section
        className="relative min-h-[calc(100svh-4rem)] overflow-hidden"
        style={entryHeroStyle}
      >
        <Image
          src={copy.image}
          alt={copy.imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        <header className="relative z-10 mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between px-6 lg:px-10">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 text-[color:var(--entry-hero-ink)]"
            aria-label={`${config.displayName} ${english ? "home" : "首页"}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-black/15 bg-white/90">
              <EntryProfileIcon profile={config.profile} />
            </span>
            <span className="truncate text-base font-semibold">
              {config.displayName}
            </span>
          </Link>
          <div className="flex items-center gap-2 rounded-md bg-[color:var(--entry-hero-surface)] p-1 text-[color:var(--entry-hero-ink)]">
            <PublicLocaleSwitcher locale={locale} variant="compact" />
            <ThemeToggle locale={locale} />
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-[1280px] items-center px-6 pb-16 lg:px-10">
          <div className="max-w-[640px]">
            <p className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[color:var(--entry-hero-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--entry-hero-ink)]">
              <ShieldCheck className="h-4 w-4 text-[color:var(--entry-hero-accent)]" />
              {copy.category}
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] text-[color:var(--entry-hero-ink)] sm:text-5xl lg:text-6xl">
              {config.displayName}
            </h1>
            {config.companyName ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--entry-hero-muted)]">
                <Building2 className="h-4 w-4" />
                {english ? "Operated by" : "所属公司"} {config.companyName}
              </p>
            ) : null}
            <p className="mt-5 max-w-[600px] text-balance text-2xl font-semibold leading-tight text-[color:var(--entry-hero-ink)] sm:text-3xl">
              {copy.headline}
            </p>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-[color:var(--entry-hero-muted)]">
              {copy.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-md px-5">
                <Link href="/login" data-testid="deployment-entry-login">
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  {copy.primaryAction}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-12 rounded-md border border-black/15 bg-[color:var(--entry-hero-surface)] px-5 text-[color:var(--entry-hero-ink)] hover:bg-white"
              >
                <Link
                  href={copy.secondaryHref}
                  data-testid="deployment-entry-secondary"
                >
                  {copy.secondaryAction}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-[color:var(--entry-hero-muted)]">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--entry-hero-accent)]" />
                {copy.assurance}
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    databaseAvailable
                      ? "bg-[color:var(--entry-hero-accent)]"
                      : "bg-[color:var(--entry-hero-warning)]"
                  }`}
                />
                {databaseAvailable
                  ? english
                    ? "Identity service available"
                    : "身份服务可用"
                  : english
                    ? "Identity service reconnecting"
                    : "身份服务正在重连"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label={english ? "Entry checkpoints" : "进入流程"}
        className="border-y border-[color:var(--border)] bg-[color:var(--surface)]"
      >
        <div className="mx-auto grid w-full max-w-[1280px] md:grid-cols-3">
          {copy.checkpoints.map((checkpoint, index) => (
            <div
              key={checkpoint.title}
              className="border-b border-[color:var(--border)] px-6 py-7 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 lg:px-10"
            >
              <p className="text-xs font-semibold text-[color:var(--accent)]">
                0{index + 1}
              </p>
              <h2 className="mt-2 text-base font-semibold">
                {checkpoint.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {checkpoint.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
