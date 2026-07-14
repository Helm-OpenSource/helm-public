import { redirect } from "next/navigation";

import { resolveWorkspaceLandingPath } from "@/lib/shell/workspace-landing";

// 工作区着陆:角色感知落点(role-home-routing 消费者)。绑定 role-home-routing 的租户按目的地
// 落 workstation 原生页(如光潽管理→/guangpu/home);未绑定/异常 → /dashboard(Core 默认,零回归)。
export default async function WorkspaceIndexPage() {
  const target = await resolveWorkspaceLandingPath();
  redirect(target);
}
