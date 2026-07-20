import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { resolveUiLocale } from "@/lib/i18n/config";
import { getPublicOperatingIdentity } from "@/lib/public-operating-identity.server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Privacy Notice | Helm" : "隐私说明 | Helm",
    description: english
      ? "Read the current public privacy notice for this Helm deployment."
      : "查看当前 Helm 部署的公开隐私说明。",
  };
}

export default async function PrivacyPage() {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const operatingIdentity = getPublicOperatingIdentity();

  const sections = english
    ? [
        {
          title: "Data we need",
          body: "We process the account, membership, workspace, audit, and product-operation data needed to provide this deployment. Optional integrations process only the scopes configured and authorized by the deployment owner.",
        },
        {
          title: "Why we use it",
          body: "We use data to authenticate users, operate workspaces, provide review-first product functions, secure the service, diagnose failures, and meet documented legal obligations. Helm recommendations are not automatic commitments or approvals.",
        },
        {
          title: "Retention and providers",
          body: "Retention periods, subprocessors, model providers, and regional routing depend on the deployment configuration and must be reviewed before production. Controlled-pilot defaults are not a production data-processing agreement.",
        },
        {
          title: "Your choices",
          body: "Ask the deployment owner about access, correction, export, deletion, consent withdrawal, or account closure. Requests remain subject to identity verification, applicable law, and necessary security or audit retention.",
        },
      ]
    : [
        {
          title: "我们需要哪些数据",
          body: "我们处理提供本部署所必需的账号、成员关系、工作区、审计和产品运行数据。可选集成只处理部署负责人已配置并授权的范围。",
        },
        {
          title: "为什么使用这些数据",
          body: "数据用于身份验证、工作区运行、复核优先的产品功能、安全防护、故障诊断及履行已有依据的法定义务。Helm 的建议不等于自动承诺或自动批准。",
        },
        {
          title: "保留期限与服务提供方",
          body: "数据保留期限、子处理方、模型提供方和地域路由取决于部署配置，正式生产前必须单独复核。受控试点默认值不构成生产数据处理协议。",
        },
        {
          title: "你的选择",
          body: "如需访问、更正、导出、删除、撤回同意或关闭账号，请联系部署负责人。相关请求仍需完成身份核验，并遵守适用法律及必要的安全或审计留存要求。",
        },
      ];

  return (
    <main className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">
              {operatingIdentity.operatorDisplayName} · {operatingIdentity.productBrand}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {english ? "Privacy Notice" : "隐私说明"}
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

        <section className="space-y-3 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">
          <h2 className="font-semibold text-[color:var(--foreground)]">
            {english ? "Legal operator status" : "法定运营主体状态"}
          </h2>
          <p>
            {operatingIdentity.legalRegistrationVerified && operatingIdentity.legalName
              ? operatingIdentity.legalName
              : english
                ? "No verified legal operator has been declared by this deployment. Do not treat this notice as registration or production-compliance evidence."
                : "该部署尚未声明经核验的法定运营主体。请勿将本说明视为工商登记或生产合规证明。"}
          </p>
          <p>
            {english
              ? "This deployment declaration does not replace legal review, filing, or registration evidence."
              : "该部署声明不能替代法律审阅、备案或工商登记证据。"}
          </p>
          <p>
            <Link href="/terms" className="font-semibold text-[color:var(--foreground)] underline underline-offset-4">
              {english ? "Read the User Agreement" : "阅读《用户协议》"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
