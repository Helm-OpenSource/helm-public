export type LoadingRecoveryCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  primaryCta: string;
  secondaryCta: string;
  dashboardCta: string;
  dashboardHref: string;
  demoCta: string;
  demoHref: string;
  publicCta: string;
  publicHref: string;
  assurance: string;
};

export function withLoadingRecoveryFragmentReset(targetPath: string) {
  return targetPath.includes("#") ? targetPath : `${targetPath}#`;
}

export function getLoadingRecoveryCopy(english: boolean): LoadingRecoveryCopy {
  return english
    ? {
        eyebrow: "Entry check",
        title: "Preparing this page",
        summary:
          "If this page is still waiting, you can retry, open the workspace, enter the demo chooser, or return to the public home; these recovery entries do not generate reports, approve actions, or send externally.",
        primaryCta: "Return to sign in",
        secondaryCta: "Retry current page",
        dashboardCta: "Open workspace",
        dashboardHref: "/dashboard",
        demoCta: "Open demo entry",
        demoHref: "/demo",
        publicCta: "Open public home",
        publicHref: "/?view=public#entry",
        assurance:
          "No report, approval or outbound action is running from this screen.",
      }
    : {
        eyebrow: "入口确认",
        title: "正在准备当前页面",
        summary:
          "如果当前页面仍在等待，你可以先重试，也可以直接打开工作台、演示入口或公开首页；这些恢复入口不会生成报告、审批动作或对外发送内容。",
        primaryCta: "回到登录入口",
        secondaryCta: "重试当前页面",
        dashboardCta: "打开工作台",
        dashboardHref: "/dashboard",
        demoCta: "打开演示入口",
        demoHref: "/demo",
        publicCta: "打开公开首页",
        publicHref: "/?view=public#entry",
        assurance: "这个页面不会生成报告、审批动作或对外发送内容。",
      };
}
