import { WorkerEntitlementStatus, WorkerEntitlementType } from "@prisma/client";

type LocalizedText = {
  zh: string;
  en: string;
};

export type WorkerCommercialCatalogEntry = {
  key: string;
  entitlementType: WorkerEntitlementType;
  defaultStatus: WorkerEntitlementStatus;
  name: LocalizedText;
  description: LocalizedText;
  commercialMode: LocalizedText;
  usagePath: LocalizedText;
  futurePath: LocalizedText;
};

export type WorkerCommercialWiringLike = {
  workerKey: string;
  entitlementType: WorkerEntitlementType;
  status: WorkerEntitlementStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  internalLimit: number | null;
};

export type WorkerCommercialWiringView = {
  workerKey: string;
  label: LocalizedText;
  description: LocalizedText;
  commercialMode: LocalizedText;
  commercialTruth: LocalizedText;
  usagePath: LocalizedText;
  futurePath: LocalizedText;
  isIncludedCore: boolean;
  isReservedFuturePath: boolean;
  isCommercialActive: boolean;
  railFamily: "INCLUDED" | "MONTHLY" | "PER_USE";
};

export const WORKER_COMMERCIAL_CATALOG: readonly WorkerCommercialCatalogEntry[] = [
  {
    key: "meeting_os_worker",
    entitlementType: WorkerEntitlementType.INCLUDED,
    defaultStatus: WorkerEntitlementStatus.ACTIVE,
    name: {
      zh: "会议主回路执行单元",
      en: "Meeting OS Worker",
    },
    description: {
      zh: "负责会议主回路、会议工作区与入口上下文的核心执行单元。",
      en: "Core worker for the meeting loop, meeting workspace, and ingress context.",
    },
    commercialMode: {
      zh: "已包含的核心执行单元",
      en: "Included core worker",
    },
    usagePath: {
      zh: "试用和付费态默认包含，不单独售卖。",
      en: "Included in both trial and paid access, with no separate sale path.",
    },
    futurePath: {
      zh: "这条能力已经属于当前核心产品，不是未来增值路径。",
      en: "This capability is already part of the core product, not a future add-on rail.",
    },
  },
  {
    key: "review_memory_worker",
    entitlementType: WorkerEntitlementType.INCLUDED,
    defaultStatus: WorkerEntitlementStatus.ACTIVE,
    name: {
      zh: "复核与记忆执行单元",
      en: "Review & Memory Worker",
    },
    description: {
      zh: "负责审批、记忆生命周期、理由链与治理可读性的核心执行单元。",
      en: "Core worker for approvals, memory lifecycle, reason chains, and governance readability.",
    },
    commercialMode: {
      zh: "已包含的核心执行单元",
      en: "Included core worker",
    },
    usagePath: {
      zh: "试用和付费态默认包含，不单独售卖。",
      en: "Included in both trial and paid access, with no separate sale path.",
    },
    futurePath: {
      zh: "这条能力已经属于当前核心产品，不是未来增值路径。",
      en: "This capability is already part of the core product, not a future add-on rail.",
    },
  },
  {
    key: "deal_desk_worker",
    entitlementType: WorkerEntitlementType.ADD_ON_MONTHLY,
    defaultStatus: WorkerEntitlementStatus.INACTIVE,
    name: {
      zh: "交易协同执行单元",
      en: "Deal Desk Worker",
    },
    description: {
      zh: "预留给未来按月增值的商业协同执行单元，目前只作为商业接线预留。",
      en: "Reserved for a future monthly commercial add-on worker, visible today only as commercial wiring.",
    },
    commercialMode: {
      zh: "未来按月增值路径",
      en: "Add-on monthly rail",
    },
    usagePath: {
      zh: "未来按月增值路径，可挂到现有支付链路，但当前还没有独立购买流程。",
      en: "Future monthly add-on path that can attach to current payment rails later, without a live purchase flow yet.",
    },
    futurePath: {
      zh: "当前只保留商业接线，不代表执行单元市场或应用商店已开放。",
      en: "Currently reserved only as commercial wiring; this does not imply a worker marketplace or app store.",
    },
  },
  {
    key: "specialist_review_worker",
    entitlementType: WorkerEntitlementType.ADD_ON_PER_USE,
    defaultStatus: WorkerEntitlementStatus.INACTIVE,
    name: {
      zh: "专家复核执行单元",
      en: "Specialist Review Worker",
    },
    description: {
      zh: "预留给未来按次增值的专家型执行单元，目前只作为商业接线预留。",
      en: "Reserved for a future per-use specialist worker, visible today only as commercial wiring.",
    },
    commercialMode: {
      zh: "未来按次增值路径",
      en: "Add-on per-use rail",
    },
    usagePath: {
      zh: "未来按次增值路径，可挂到现有支付链路，但当前还没有独立购买流程。",
      en: "Future per-use add-on path that can attach to current payment rails later, without a live purchase flow yet.",
    },
    futurePath: {
      zh: "当前只保留商业接线，不代表执行单元市场或专家商店已开放。",
      en: "Currently reserved only as commercial wiring; this does not imply a worker marketplace or expert store.",
    },
  },
] as const;

export const FIRST_PARTY_CORE_WORKERS = WORKER_COMMERCIAL_CATALOG.filter(
  (worker) => worker.entitlementType === WorkerEntitlementType.INCLUDED,
);

export const FUTURE_ADD_ON_WORKERS = WORKER_COMMERCIAL_CATALOG.filter(
  (worker) => worker.entitlementType !== WorkerEntitlementType.INCLUDED,
);

export function getWorkerCommercialCatalogEntry(workerKey: string) {
  return WORKER_COMMERCIAL_CATALOG.find((worker) => worker.key === workerKey) ?? null;
}

export function buildWorkerCommercialWiringView(
  entitlement: WorkerCommercialWiringLike,
): WorkerCommercialWiringView {
  const catalogEntry = getWorkerCommercialCatalogEntry(entitlement.workerKey);
  const fallbackRailFamily =
    entitlement.entitlementType === WorkerEntitlementType.ADD_ON_MONTHLY
      ? "MONTHLY"
      : entitlement.entitlementType === WorkerEntitlementType.ADD_ON_PER_USE
        ? "PER_USE"
        : "INCLUDED";

  const railFamily = catalogEntry
    ? catalogEntry.entitlementType === WorkerEntitlementType.ADD_ON_MONTHLY
      ? "MONTHLY"
      : catalogEntry.entitlementType === WorkerEntitlementType.ADD_ON_PER_USE
        ? "PER_USE"
        : "INCLUDED"
    : fallbackRailFamily;

  const label = catalogEntry?.name ?? {
    zh: entitlement.workerKey,
    en: entitlement.workerKey,
  };
  const description = catalogEntry?.description ?? {
    zh: "未来执行 entitlement 路径。",
    en: "Future worker entitlement path.",
  };
  const commercialMode = catalogEntry?.commercialMode ?? {
    zh: "未来执行单元路径",
    en: "Future worker rail",
  };
  const usagePath = catalogEntry?.usagePath ?? {
    zh: "未来可接到现有支付链路，但当前没有独立购买流程。",
    en: "Can attach to current payment rails later, with no live purchase flow yet.",
  };
  const futurePath = catalogEntry?.futurePath ?? {
    zh: "当前只保留商业接线，不代表市场已开放。",
    en: "Currently reserved only as commercial wiring; this does not imply a marketplace.",
  };

  const isIncludedCore = entitlement.entitlementType === WorkerEntitlementType.INCLUDED;
  const isCommercialActive = !isIncludedCore && entitlement.status === WorkerEntitlementStatus.ACTIVE;
  const isReservedFuturePath =
    !isIncludedCore && entitlement.status === WorkerEntitlementStatus.INACTIVE;

  const commercialTruth = isIncludedCore
    ? {
        zh:
          entitlement.status === WorkerEntitlementStatus.ACTIVE
            ? "当前作为已包含的核心执行单元生效。"
            : "仍属于已包含的核心执行单元真实口径，但当前没有处于生效状态。",
        en:
          entitlement.status === WorkerEntitlementStatus.ACTIVE
            ? "Currently active as an included core worker."
            : "Still belongs to the included core-worker truth, but is not currently active.",
      }
    : entitlement.status === WorkerEntitlementStatus.ACTIVE
      ? railFamily === "MONTHLY"
        ? {
            zh: "当前按月增值商业接线已生效，但仍不是执行单元市场。",
            en: "Monthly add-on commercial wiring is active now, while still not being a worker marketplace.",
          }
        : {
            zh: "当前按次增值商业接线已生效，但仍不是执行单元市场。",
            en: "Per-use add-on commercial wiring is active now, while still not being a worker marketplace.",
          }
      : entitlement.status === WorkerEntitlementStatus.CANCELED
        ? {
            zh: "当前商业接线已停用，记录仍保留给运营与账务真实口径。",
            en: "Commercial wiring is currently inactive while the record remains for operational and billing truth.",
          }
        : railFamily === "MONTHLY"
          ? {
              zh: "当前只保留按月增值预留路径，不代表已开放购买。",
              en: "Only a reserved monthly add-on path is visible right now; it does not imply live purchasing.",
            }
          : {
              zh: "当前只保留按次增值预留路径，不代表已开放购买。",
              en: "Only a reserved per-use add-on path is visible right now; it does not imply live purchasing.",
            };

  return {
    workerKey: entitlement.workerKey,
    label,
    description,
    commercialMode,
    commercialTruth,
    usagePath,
    futurePath,
    isIncludedCore,
    isReservedFuturePath,
    isCommercialActive,
    railFamily,
  };
}
