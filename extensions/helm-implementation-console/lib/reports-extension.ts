/**
 * Helm 客户接入控制台（Helm Implementation Console）
 *
 * 把客户接入实施手册（CUSTOMER_ONBOARDING_PLAYBOOK_V1.md）的运营状态作为
 * Helm 自身可管理的资产呈现。复用现有 Opportunity / MemoryEntry / Blocker
 * schema 承接 客户接入项目 / Artifact / Open work-item 概念。
 *
 * 设计依据：docs/implementation/HELM_AS_IMPLEMENTATION_CONSOLE_V1.md
 */

import type { WorkspaceLike } from "@/lib/extensions/registry";
import { HELM_RESERVED_WORKSPACE_SYSTEM_KEY } from "@/lib/workspace-identity";

const DEFAULT_ACCESS_WORKSPACE_SLUGS = [
  // dogfood：helm-sales-demo workspace 已 seed 米盾云作为客户接入项目（PR-A1）
  "helm-sales-demo",
] as const;

export type HelmImplementationConsoleReportTab = "customer-onboarding";

export async function getHelmImplementationConsoleAccess(
  workspace: WorkspaceLike,
): Promise<{ ok: boolean }> {
  if (!workspace?.slug) return { ok: false };
  if (isHelmImplementationConsoleReservedWorkspace(workspace)) {
    return { ok: true };
  }
  return { ok: getImplementationConsoleWorkspaceSlugs().has(workspace.slug) };
}

export function buildHelmImplementationConsoleReportsTabs(
  english: boolean,
): ReadonlyArray<{ key: string; label: string; href: string }> {
  return [
    {
      key: "customer-onboarding",
      label: english ? "Customer onboarding" : "客户接入进度",
      href: "/reports?tab=customer-onboarding",
    },
  ];
}

export const HELM_IMPLEMENTATION_CONSOLE_EXTENSION_KEY =
  "helm-implementation-console" as const;

export function buildHelmImplementationConsoleNavCluster(english: boolean) {
  return {
    extensionKey: HELM_IMPLEMENTATION_CONSOLE_EXTENSION_KEY,
    label: english ? "Implementation" : "客户接入",
    items: [
      {
        key: `${HELM_IMPLEMENTATION_CONSOLE_EXTENSION_KEY}:onboarding-progress`,
        href: "/reports?tab=customer-onboarding",
        label: english ? "Customer onboarding console" : "客户接入控制台",
        iconKey: "rocket" as const,
        description: english
          ? "Phase gate progress, artifacts and blockers per onboarding project."
          : "客户接入项目的 phase gate 进度、artifact 与未决项。",
      },
    ],
  };
}

export function normalizeHelmImplementationConsoleReportTab(
  requested: string | null,
): HelmImplementationConsoleReportTab | null {
  if (requested === "customer-onboarding") return "customer-onboarding";
  return null;
}

function readAdditionalImplementationConsoleWorkspaceSlugs() {
  return (process.env.HELM_IMPLEMENTATION_CONSOLE_WORKSPACE_SLUGS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getImplementationConsoleWorkspaceSlugs() {
  return new Set<string>([
    ...DEFAULT_ACCESS_WORKSPACE_SLUGS,
    ...readAdditionalImplementationConsoleWorkspaceSlugs(),
  ]);
}

function isHelmImplementationConsoleReservedWorkspace(workspace: WorkspaceLike) {
  return (
    workspace.workspaceClass === "HELM_RESERVED" &&
    workspace.systemKey === HELM_RESERVED_WORKSPACE_SYSTEM_KEY
  );
}
