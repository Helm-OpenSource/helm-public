import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildGettingStartedEntryContract } from "@/lib/auth/public-entry";
import { getCurrentUser } from "@/lib/auth/session";
import { FIRST_LOGIN_IDENTITY_SETUP_COOKIE } from "@/lib/auth/session-cookies";
import { normalizeEmailAddress, normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { resolveUiLocale } from "@/lib/i18n/config";
import { Card, CardContent } from "@/components/ui/card";
import { FirstLoginIdentityCompletionPanel } from "@/features/auth/first-login-identity-completion-panel";

type GettingStartedPageSearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(
  params: GettingStartedPageSearchParams | undefined,
  key: string,
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function GettingStartedPage({
  searchParams,
}: {
  searchParams?: Promise<GettingStartedPageSearchParams>;
} = {}) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const entryContract = buildGettingStartedEntryContract({ locale });

  if (!user) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const mode = readSearchParam(params, "mode");
  const hasPendingIdentitySetup = Boolean(
    cookieStore.get(FIRST_LOGIN_IDENTITY_SETUP_COOKIE)?.value,
  );
  const identityCompletionMode = hasPendingIdentitySetup || mode === "identity-completion";

  if (identityCompletionMode) {
    const requiresEmail = !normalizeEmailAddress(user.email ?? "");
    const requiresPhone = !normalizePhoneNumber(user.phone ?? "");
    const requiresPasswordSetup = !user.passwordHash;

    return (
      <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16 lg:px-10">
          <section className="space-y-3" data-testid="first-login-identity-completion">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {english ? "Finish setting up your identity." : "首次登录初始化"}
            </h1>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Add what's missing below and you'll go straight to your workspace."
                : "把下面缺的补齐，就可以直接进入工作区。"}
            </p>
          </section>

          <FirstLoginIdentityCompletionPanel
            locale={locale}
            requiresEmail={requiresEmail}
            requiresPhone={requiresPhone}
            requiresPasswordSetup={requiresPasswordSetup}
            defaultEmail={user.email ?? ""}
            defaultPhone={user.phone ?? ""}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16 lg:px-10">
        <section className="space-y-3">
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {entryContract.title}
          </h1>
          <p className="text-base leading-7 text-[color:var(--muted)]">
            {entryContract.summary}
          </p>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {entryContract.boundaryNote}
          </p>
        </section>

        <section
          data-testid="getting-started-placeholder-card"
          aria-label={english ? "Placeholder judgement card" : "占位判断卡"}
        >
          <Card className="border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] opacity-80">
            <CardContent className="space-y-3 py-6">
              <p className="text-lg font-semibold leading-7 text-[color:var(--foreground)]">
                {english
                  ? "Connect a source — meetings, mail or CRM — and your first call will land here."
                  : "接一个源——会议、邮件或 CRM——你的第一张判断就会落到这里。"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Until then, nothing is sent and nothing is written back."
                  : "在那之前不会发出任何东西，也不会写回任何系统。"}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col items-center gap-4">
          <Button asChild size="lg" className="px-8">
            <Link href={entryContract.primaryHref}>
              {entryContract.primaryLabel}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Link
            href={entryContract.secondaryHref}
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {entryContract.secondaryLabel}
          </Link>
          <p className="text-xs text-[color:var(--muted-foreground)]">{entryContract.skipHint}</p>
        </section>
      </main>
    </div>
  );
}
