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
import type {
  PermissionDecision,
  PermissionFailureCode,
  PermissionSubject,
} from "@/lib/auth/permission-policy";
import type { MainlineReadout } from "@/lib/shell/operating-mainline";

export type WorkspaceLike = {
  id: string;
  slug: string;
  systemKey?: string | null;
  workspaceClass?: string | null;
};

export type ExtensionAccessContext = {
  subject?: PermissionSubject | null;
  traceId?: string;
};

export type ExtensionAccessResult = {
  ok: boolean;
  reason?: string;
  failureCode?: PermissionFailureCode;
  decision?: PermissionDecision;
};

export type ExtensionAccessProbe = (
  workspace: WorkspaceLike,
  context?: ExtensionAccessContext,
) => Promise<ExtensionAccessResult>;

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

export type ReportsExtensionSurfaceUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type ReportsExtensionSurfaceMembership = {
  id?: string;
  workspaceId: string;
  role?: string;
  status?: string;
  rolePresetKey?: string | null;
  persona?: string | null;
};

export type ReportsExtensionSurfaceContext = {
  matchedTab: string;
  english: boolean;
  workspace: WorkspaceLike;
  user?: ReportsExtensionSurfaceUser | null;
  membership?: ReportsExtensionSurfaceMembership | null;
};

export type ReportsExtensionDescriptor = {
  id: string;
  getAccess: ExtensionAccessProbe;
  buildTabs: (english: boolean) => ReadonlyArray<ReportsExtensionTab>;
  matchTab: (requested: string | undefined) => string | null;
  renderSurface: (input: ReportsExtensionSurfaceContext) => ReactNode;
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

// Pack-neutral status badge for a nav item. Tones are generic so Core stays
// agnostic of any pack's domain status vocabulary (a pack/overlay maps its own
// statuses — e.g. NPA workbench surfaceStatus — onto these tones).
export type WorkspaceNavExtensionBadgeTone = "live" | "planned" | "muted" | "blocked";

export type WorkspaceNavExtensionStatusBadge = {
  label: string;
  tone: WorkspaceNavExtensionBadgeTone;
};

export type WorkspaceNavExtensionItem = {
  key: string;
  href: string;
  label: string;
  iconKey: WorkspaceNavExtensionIconKey;
  description?: string;
  // Optional, additive: when set, renders a small status badge after the label.
  // Existing items without it render unchanged (backward compatible).
  statusBadge?: WorkspaceNavExtensionStatusBadge;
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
  getAccess: ExtensionAccessProbe;
  buildCluster: (english: boolean) => WorkspaceNavExtensionCluster;
};

/**
 * Shell-surface stability marker (Default Operating Workspace blueprint,
 * Phase 2). `experimental` = the shape is open into `PackContributions` but the
 * contract is **not frozen** — freezing (removing `experimental`) requires a
 * second real *external* consumer per blueprint §3.2 (Core default provider +
 * one private Overlay do not constitute two independent consumers).
 */
export type ShellSurfaceStability = "experimental";

/**
 * Single-winner "operating mainline" surface provider (blueprint §4.2).
 *
 * The readout is data-only: `MainlineReadout` carries no action-callback fields
 * and `validateMainlineReadout` runtime-rejects any function-typed node field
 * (iron law §4.1.1 — surfaces are read/navigate only). `getAccess` /
 * `buildMainline` are the provider-side build functions (the §4.2
 * `MainlineDescriptor` shape), not per-item action callbacks.
 *
 * Selection follows the binding-is-authorization model (§4.3): a provider only
 * wins with an explicit, valid, surface-scoped binding; otherwise the Core
 * default provider is used. `priority` is diagnostic ordering / admin
 * recommendation only and never auto-takes-over.
 */
export type MainlineProviderContribution = {
  providerId: string;
  /** Incompatible versions must not enter the candidate set (§4.3.2). */
  contractVersion: string;
  /** Diagnostic ordering / candidate recommendation only — not runtime takeover. */
  priority: number;
  provenance: string;
  stability: ShellSurfaceStability;
  /** Reuses the existing 2500ms access-probe timeout wrapper (§4.2). */
  getAccess: ExtensionAccessProbe;
  buildMainline: (input: {
    workspace: WorkspaceLike;
    english: boolean;
  }) => Promise<MainlineReadout>;
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
