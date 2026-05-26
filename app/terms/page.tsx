import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { resolveUiLocale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "User Agreement | Helm Bridge One" : "用户协议 | Helm Bridge One",
    description: english
      ? "Read the current public user agreement for Helm Bridge One."
      : "查看 Helm Bridge One 当前公开用户协议。",
  };
}

export default async function TermsPage() {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  const sections = english
    ? [
        {
          title: "How you sign in",
          body: "Phone, password, DingTalk, WeCom — all controlled entry paths. Workspace owners can limit, review, or remove access at any time.",
        },
        {
          title: "What you can and can't do",
          body: "Use Helm for legitimate work — collaboration, review, follow-through. Don't impersonate others, don't bypass review boundaries, and don't trigger external commitments through this service that you wouldn't sign personally.",
        },
        {
          title: "Your data",
          body: "We store the account and workspace data needed to sign you in, verify you, and operate the product. Some integrations are still in controlled pilot — they don't have full production-grade redundancy yet, and we say so explicitly.",
        },
        {
          title: "Service status",
          body: "Helm runs as a workspace-first controlled pilot. Availability, providers, and entry flows may change as the product hardens. We give 7 days notice for any change that breaks an existing pilot setup.",
        },
      ]
    : [
        {
          title: "你怎么登录",
          body: "手机号、密码、钉钉、企业微信——都是受控进入路径。工作区负责人随时可以收紧、复核或回收访问权限。",
        },
        {
          title: "可以做什么 / 不能做什么",
          body: "Helm 用于正当工作——协作、复核、跟进。不得冒用他人身份、不得绕过复核边界，不得借此发起任何你不会亲自签的对外承诺。",
        },
        {
          title: "你的数据",
          body: "我们只保存登录、验证和产品运行必需的账号与工作区数据。部分集成仍处于受控试点阶段——还不具备完整生产级冗余，我们会明确告诉你。",
        },
        {
          title: "服务状态",
          body: "Helm 当前以「工作区优先 + 受控试点」方式运行。系统可用性、接入提供方、进入流程会随产品加固持续调整。任何会破坏现有试点配置的变更，我们会提前 7 天通知。",
        },
      ];

  return (
    <main className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">
              Helm Bridge One
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {english ? "User Agreement" : "用户协议"}
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {english ? "Back" : "返回"}
          </Link>
        </div>

        <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2 px-6 py-5">
              <h2 className="text-base font-semibold text-[color:var(--foreground)]">{section.title}</h2>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
