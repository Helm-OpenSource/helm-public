/**
 * lib/extensions/registry-types.ts
 *
 * Pure type surface shared by `registry-contract.ts` (the registry store) and
 * `registry.tsx` (the Core seam). Core-only: no `@/extensions/<tenant>/*`
 * imports. Kept identical to the pre-inversion public types so the existing
 * callers compile unchanged.
 */

import type { ReactNode } from "react";
import { SolutionExtensionKind } from "@prisma/client";

export type WorkspaceLike = {
  id: string;
  slug: string;
  systemKey?: string | null;
  workspaceClass?: string | null;
};

export type SolutionExtensionCatalogEntry = {
  extensionKey: string;
  kind: SolutionExtensionKind;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
};

export type ReportsExtensionTab = {
  key: string;
  label: string;
  href: string;
};

export type ReportsExtensionPageViewEvent = {
  eventName: string;
  sourcePage: string;
  targetType: string;
  targetId: string;
};

export type ResolvedReportsExtensionsType = {
  tabs: ReportsExtensionTab[];
  active: null | {
    surface: ReactNode;
    pageViewEvent: ReportsExtensionPageViewEvent | null;
  };
};

export type ReportsExtensionDescriptor = {
  id: string;
  getAccess: (workspace: WorkspaceLike) => Promise<{ ok: boolean }>;
  buildTabs: (english: boolean) => ReadonlyArray<ReportsExtensionTab>;
  matchTab: (requested: string | undefined) => string | null;
  renderSurface: (input: { matchedTab: string; english: boolean }) => ReactNode;
  buildPageViewEvent: (input: {
    matchedTab: string;
  }) => ReportsExtensionPageViewEvent | null;
  /**
   * Optional locale override for the inline degraded-panel fallback. A pack
   * whose surfaces always render in a fixed language (e.g. a zh-CN-only tenant)
   * supplies this so Core's generic fallback matches the pack's locale without
   * Core importing any tenant locale code.
   */
  resolveFallbackEnglish?: () => boolean;
};

export type AccountBindingContribution = {
  visible: boolean;
  ready: boolean;
  startPath: string;
  entryButton: (props: { english: boolean }) => ReactNode;
};

export type ResolvedImportsExtensionsType = {
  accountBinding: AccountBindingContribution | null;
};

export type BiBoardContribution = {
  previewApiUrl: string;
  handoffExecutionLogsApiUrl: string;
  ctaHref: string;
  descriptionEnglish: string;
  descriptionChinese: string;
  ctaLabelEnglish: string;
  ctaLabelChinese: string;
};

export type ResolvedApprovalsExtensionsType = {
  biBoard: BiBoardContribution | null;
};

export type WorkspaceNavExtensionIconKey =
  | "shield-check"
  | "chart"
  | "users"
  | "rocket"
  | "compass"
  | "boxes";

export type WorkspaceNavExtensionItem = {
  key: string;
  href: string;
  label: string;
  iconKey: WorkspaceNavExtensionIconKey;
  description?: string;
};

export type WorkspaceNavExtensionCluster = {
  extensionKey: string;
  label: string;
  items: WorkspaceNavExtensionItem[];
};

export type ResolvedWorkspaceNavExtensionsType = {
  clusters: WorkspaceNavExtensionCluster[];
};

export type WorkspaceNavExtensionDescriptor = {
  id: string;
  getAccess: (workspace: WorkspaceLike) => Promise<{ ok: boolean }>;
  buildCluster: (english: boolean) => WorkspaceNavExtensionCluster;
};

export type ExtensionIndustryDemoReadoutPage = {
  title: string;
  description: string;
  eyebrow: string;
  bannerTitle: string;
  bannerDescription: string;
  ctaTitle: string;
  ctaDescription: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  surface: ReactNode;
};

export type BiReportP0ProcessProductionRow = {
  orgName: string;
  empName: string;
  inPanelCaseCount: number | null;
  processedUserCount: number | null;
  connectedUserCount: number | null;
  callOutTimes: number | null;
  connectedTimes: number | null;
  validCallMinutes: number | null;
};

export type BiReportP0ProcessSopRow = {
  orgName: string;
  empName: string;
  selfConnectRatePct: number | null;
  followupCompletionRatePct: number | null;
  callTargetPersonRatePct: number | null;
  totalCallMinutes: number | null;
  complaintCount: number | null;
  complaintResolutionRatePct: number | null;
};
