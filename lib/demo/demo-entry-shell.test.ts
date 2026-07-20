import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("demo entry shell", () => {
  it("keeps the public demo entry independent from current-user DB lookup", () => {
    const source = readSource("app/demo/page.tsx");

    expect(source).not.toContain("getCurrentUser");
    expect(source).toContain('href="/trial"');
    expect(source).toContain('href="/login"');
  });

  it("uses a calm demo-loading skeleton instead of the prior recommended-order shell", () => {
    const source = readSource("app/demo/loading.tsx");

    expect(source).toContain("演示入口");
    expect(source).toContain("正在准备演示入口");
    expect(source).toContain('data-testid="demo-loading-shell"');
    expect(source).toContain('data-testid="demo-loading-skeleton"');
    expect(source).not.toContain("建议讲解顺序");
    expect(source).not.toContain("Recommended order");
    expect(source).not.toContain("完整演示页暂时停住");
    expect(source).not.toContain("full demo page pauses");
    expect(source).not.toContain("工作区确认");
    expect(source).not.toContain("正在确认你的经营工作区");
    expect(source).not.toContain("enterDemoWorkspace");
  });

  it("keeps public demo boundary copy free of autonomous-commitment phrasing", () => {
    const demoEntrySource = readSource("app/demo/page.tsx");
    const demoLoadingSource = readSource("app/demo/loading.tsx");

    expect(demoEntrySource).toContain("建议 ≠ 承诺");
    expect(demoEntrySource).toContain("不会对外发送任何内容");
    expect(demoEntrySource).toContain("不会写入客户关系系统");
    expect(demoEntrySource).not.toContain("自动获得发送");
    expect(demoEntrySource).not.toContain("默认拥有对外发送权限");
    expect(demoEntrySource).not.toContain("写入CRM");
    expect(demoEntrySource).not.toContain("转化话术");
    expect(demoEntrySource).not.toContain("Commercial framing");
    expect(demoEntrySource).not.toContain("30 天免费");
    expect(demoEntrySource).not.toContain("30-day free trial");
    expect(demoLoadingSource).toContain("不会对外发送任何内容");
    expect(demoLoadingSource).toContain("不会写回真实客户关系系统");
    expect(demoLoadingSource).not.toContain("自动获得发送");
    expect(demoLoadingSource).not.toContain("真实CRM");
  });

  it("keeps the demo workspace shell from creating desktop horizontal overflow", () => {
    const shell = readSource("components/layout/app-shell.tsx");
    const topbar = readSource("components/layout/topbar.tsx");

    expect(shell).toContain("min-w-0 max-w-full overflow-x-hidden");
    expect(shell).toContain("min-w-0 flex-1 overflow-x-hidden");
    expect(shell).toContain("mx-auto flex min-w-0 w-full max-w-[1580px]");
    expect(topbar).toContain("sticky top-0 z-20 min-w-0 max-w-full");
    expect(topbar).toContain("workspace-shell-panel flex min-w-0 max-w-full");
    expect(topbar).toContain("hidden 2xl:inline");
    expect(topbar).toContain("right-0.5 top-0.5 h-5 min-w-5");
    expect(topbar).not.toContain("relative hidden min-w-[220px]");
    expect(topbar).not.toContain("hidden xl:inline\">\n                {messages.shell.quickCreate}");
  });

  it("keeps global loading separate from demo entry actions", () => {
    const source = readSource("app/loading.tsx");
    const demoEntrySource = readSource("app/demo/page.tsx");
    const demoStartSource = readSource("app/demo/start/route.ts");

    expect(source).toContain('data-testid="global-route-loading"');
    expect(source).toContain('aria-busy="true"');
    expect(source).not.toContain('action="/demo/start"');
    expect(source).not.toContain("loading-recovery-actions");
    expect(demoEntrySource).toContain('id={`demo-workspace-${mode.mode}`}');
    expect(demoEntrySource).toContain("resolveHighlightedDemoMode(params.mode)");
    expect(demoStartSource).toContain("export async function POST");
    expect(demoStartSource).toContain("resolveDemoMode(formData.get(\"mode\"))");
    expect(demoStartSource).toContain("createSession({");
    expect(demoStartSource).toContain("function resolveRedirectOrigin");
    expect(demoStartSource).toContain('request.headers.get("host")');
    expect(demoStartSource).toContain(
      "new URL(targetPath, resolveRedirectOrigin(request))",
    );
    expect(demoStartSource).toContain("sourcePage: \"/demo/start\"");
  });

  it("keeps contact detail relationship-stage display localized and punctuation-normalized", () => {
    const source = readSource("features/contacts/contact-detail-client.tsx");

    expect(source).toContain("const relationshipStageLabel");
    expect(source).toContain("normalizeVisibleText(");
    expect(source).toContain("replace(/。{2,}/g, \"。\")");
    expect(source).not.toContain("contact.relationshipStage ??");
  });
});
