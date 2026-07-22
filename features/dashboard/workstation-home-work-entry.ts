import type {
  DashboardHomeWorkEntryCard,
  DashboardHomeWorkEntryModel,
} from "@/features/dashboard/home-work-entry";

export type WorkstationHomeEntry = {
  key: string;
  href: string;
  label: string;
};

function buildWorkstationCard(
  entry: WorkstationHomeEntry,
  english: boolean,
): DashboardHomeWorkEntryCard {
  return {
    id: `role-workstation:${entry.key}`,
    title: english ? `Open ${entry.label}` : `进入${entry.label}`,
    subject: english ? "Primary desk for this role" : "本角色日常主工位",
    statusLabel: english ? "Role desk" : "本角色主工位",
    nextStep: english
      ? "Continue from the desk assigned by the bound role-home route."
      : "从已绑定的角色家工位继续，不再先进入跨角色的通用事项。",
    boundary: english
      ? "Navigation does not grant review, execution, or external-send authority."
      : "导航不授予复核、执行或对外发送权限。",
    href: entry.href,
    ctaLabel: english ? "Open desk" : "打开工位",
  };
}

/**
 * Keep routed anomalies first, then guarantee one role-owned workstation entry.
 * Existing capabilities and review queues stay intact; this changes IA only.
 */
export function routeWorkEntryToWorkstation(input: {
  model: DashboardHomeWorkEntryModel;
  workstation: WorkstationHomeEntry;
  english: boolean;
}): DashboardHomeWorkEntryModel {
  const roleAnomalyItems = input.model.roleAnomalyItems ?? [];
  const workstationCard = buildWorkstationCard(
    input.workstation,
    input.english,
  );

  return {
    ...input.model,
    state: "returning-active",
    title:
      roleAnomalyItems.length > 0
        ? input.english
          ? "Handle routed anomalies, then return to your desk."
          : "先推进本角色异常，再回到主工位。"
        : input.english
          ? "Continue from your role's primary desk."
          : "先从本角色主工位继续。",
    summary: input.english
      ? "The bound role-home route is the default work entry; cross-role work does not take over this position."
      : "角色家绑定决定默认工作入口；跨角色通用事项不再占据首要位置。",
    topWorkItems: [...roleAnomalyItems.slice(0, 2), workstationCard],
    resumeItem: workstationCard,
    reviewItemsArePrimary: false,
  };
}
