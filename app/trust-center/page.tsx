import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { BoundaryBar } from "@/components/shared/boundary-bar";
import fixtureJson from "@/docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json";
import {
  buildPublicTrustCenterReadout,
  type TrustCenterFixtureLike,
} from "@/lib/trust-center/public-trust-center-readout";
import { resolveUiLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  return {
    title: english ? "Helm Trust Center | Public Safe" : "Helm Trust Center | 公开安全",
    description: english
      ? "Authorization, notice, retention, audit, withdrawal, certification, and forbidden-action posture for Helm."
      : "Helm 的授权、告知、保留期、审计、撤销、认证与禁止项姿态。",
  };
}

export default async function TrustCenterPage() {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const result = buildPublicTrustCenterReadout({
    english,
    fixture: fixtureJson as unknown as TrustCenterFixtureLike,
  });

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-[color:var(--background)] px-6 py-10 text-[color:var(--foreground)]">
        <div
          role="alert"
          data-trust-center="error"
          className="mx-auto w-full max-w-3xl rounded-lg border-2 border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-5 py-4 text-sm text-[color:var(--status-danger-text)]"
        >
          <span className="font-semibold">
            {english ? "Trust fixture failed its safety check" : "信任契约 fixture 未通过安全检查"}
          </span>
          <span className="ml-2 font-mono text-xs">
            {result.errorCode} · {result.offendingFlags.join(", ")}
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8" data-trust-center="ok">
        <section className="border-b border-[color:var(--border)] pb-8">
          <p className="text-xs font-medium uppercase text-[color:var(--accent)]">
            {result.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">{result.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--muted-foreground)]">
            {result.summary}
          </p>
        </section>

        <BoundaryBar
          english={english}
          copy={{
            observed: {
              zh: "Helm 的公开信任姿态：授权、告知、保留期、审计、撤销、认证与禁止项。",
              en: "Helm's public trust posture: authorization, notice, retention, audit, withdrawal, certification, and forbidden actions.",
            },
            wontDo: {
              zh: "本页不构成法律意见、认证、转售授权或生产合规声明。",
              en: "This page is not legal advice, certification, reseller authorization, or a production compliance statement.",
            },
            decider: {
              zh: "任何正式承诺由人工授权与合同定义。",
              en: "Every formal commitment is defined by human authorization and contract.",
            },
            negatives: [
              { zh: "无自动外发", en: "No auto-send" },
              { zh: "无自动审批", en: "No auto-approve" },
              { zh: "无自动采购", en: "No auto-procure" },
              { zh: "无灰色设备", en: "No gray devices" },
            ],
          }}
        />

        <section className="grid gap-4 md:grid-cols-2">
          {result.sections.map((section) => (
            <article
              key={section.key}
              data-trust-section={section.key}
              className="min-w-0 border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {section.body}
              </p>
              <p className="mt-4 border-t border-[color:var(--border)] pt-3 text-xs text-[color:var(--muted-foreground)]">
                {english ? "Evidence ref: " : "证据位置："}
                <code className="font-mono">{section.evidenceRef}</code>
              </p>
            </article>
          ))}
        </section>

        <section className="border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h2 className="text-lg font-semibold">
            {english ? "Gray-device redlines (all blocked)" : "灰色设备红线（全部禁止）"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {result.grayDeviceRedlines.map((item) => (
              <li
                key={item}
                data-trust-redline
                className="rounded-full border border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-2.5 py-0.5 text-xs text-[color:var(--status-danger-text)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h2 className="text-lg font-semibold">
            {english ? "What Helm never does" : "Helm 永远不做"}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-[color:var(--muted-foreground)] md:grid-cols-2">
            {result.neverList.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl text-xs leading-6 text-[color:var(--muted-foreground)]">
            {result.nonClaimNote}
            {" "}
            <span className="font-mono">fixture: {result.fixtureVersion}</span>
            {" · "}
            <span className="font-mono">npm run check:ai-shelf-trust-center-contract</span>
          </p>
          <Link
            className="inline-flex w-fit items-center justify-center border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-muted)]"
            href="/"
          >
            {english ? "Open Helm" : "打开 Helm"}
          </Link>
        </section>
      </div>
    </main>
  );
}
