import { redirect } from "next/navigation";

import { resolveWorkspaceLandingPath } from "@/lib/shell/workspace-landing";

// 工作区着陆:角色感知落点(role-home-routing 消费者)。绑定 role-home-routing 的租户按目的地
// 落 workstation 原生页(provider 贡献的站内路由);未绑定/异常 → /dashboard(Core 默认,零回归)。
// 租户无关:不硬编码任何租户/工位,一切经注册表 + 绑定解析。
export default async function WorkspaceIndexPage() {
  const target = await resolveWorkspaceLandingPath();
  redirect(target);
}
