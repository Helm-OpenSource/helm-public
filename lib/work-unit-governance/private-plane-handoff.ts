import {
  buildPublicCoreNoopActivationRuntimeExecutor,
  type ActivationRuntimeExecutorMode,
} from "./activation-runtime-binding";
import {
  buildPublicCoreNoopLearningAssetStore,
  type LearningAssetStoreMode,
} from "./learning-asset-store-binding";
import {
  buildPublicCoreNoopOwnerNotificationDispatcher,
  type OwnerNotificationDispatcherMode,
} from "./owner-notification-binding";
import {
  buildPublicCoreNoopPrivateMainlineStore,
  type PrivateMainlineStoreMode,
} from "./private-mainline-store";

export type PrivatePlaneHandoffLaneId =
  | "private_mainline_store"
  | "owner_notification_dispatcher"
  | "activation_runtime_executor"
  | "learning_asset_store";

export type PrivatePlaneBindingMode =
  | PrivateMainlineStoreMode
  | OwnerNotificationDispatcherMode
  | ActivationRuntimeExecutorMode
  | LearningAssetStoreMode;

export type PrivatePlaneHandoffLane = {
  readonly laneId: PrivatePlaneHandoffLaneId;
  readonly label: {
    readonly zh: string;
    readonly en: string;
  };
  readonly privateResponsibility: {
    readonly zh: string;
    readonly en: string;
  };
  readonly publicCoreBoundary: {
    readonly zh: string;
    readonly en: string;
  };
  readonly bindingRef: string;
  readonly bindingMode: PrivatePlaneBindingMode;
  readonly handoffStatus: "prepared_handoff_only";
  readonly privatePlaneRequiredForCompletion: true;
  readonly publicCorePersists: false;
  readonly publicCoreSendsExternally: false;
  readonly publicCoreWritesTarget: false;
  readonly publicCoreActivatesRuntime: false;
  readonly publicCoreGrantsApproval: false;
  readonly publicCoreAppliesAsset: false;
};

export type PrivatePlaneHandoffReadout = {
  readonly schemaVersion: "helm.private-plane-handoff-readout.v1";
  readonly userVisible: {
    readonly title: {
      readonly zh: string;
      readonly en: string;
    };
    readonly summary: {
      readonly zh: string;
      readonly en: string;
    };
    readonly boundary: {
      readonly zh: string;
      readonly en: string;
    };
    readonly primaryAction: {
      readonly zh: string;
      readonly en: string;
    };
  };
  readonly lanes: readonly PrivatePlaneHandoffLane[];
  readonly readinessClaim: "not_readiness";
  readonly activationClaim: "not_activation";
  readonly applicationClaim: "not_applied";
  readonly publicCorePersists: false;
  readonly createsExternalEffect: false;
  readonly sendsExternally: false;
  readonly writesTarget: false;
  readonly activatesRuntime: false;
  readonly grantsApproval: false;
  readonly appliesAsset: false;
};

export function buildPrivatePlaneHandoffReadout(): PrivatePlaneHandoffReadout {
  const privateMainlineStore = buildPublicCoreNoopPrivateMainlineStore();
  const ownerNotificationDispatcher = buildPublicCoreNoopOwnerNotificationDispatcher();
  const activationRuntimeExecutor = buildPublicCoreNoopActivationRuntimeExecutor();
  const learningAssetStore = buildPublicCoreNoopLearningAssetStore();

  return {
    schemaVersion: "helm.private-plane-handoff-readout.v1",
    userVisible: {
      title: {
        zh: "私有执行面交接边界",
        en: "Private-plane handoff boundary",
      },
      summary: {
        zh: "公开 Core 只把已经验证的交接对象整理成低复杂度清单；真实保存、通知、运行时生效和经验资产应用都留在私有面完成。",
        en: "Public Core turns the verified handoff objects into a low-complexity checklist; real persistence, notification, runtime activation, and learning-asset application stay in the private plane.",
      },
      boundary: {
        zh: "这不是生产就绪、不是批准、不是运行时生效，也不是经验资产已应用。",
        en: "This is not production readiness, approval, runtime activation, or applied learning.",
      },
      primaryAction: {
        zh: "在私有面接入真实适配器并保留回执",
        en: "Attach real private adapters and keep receipts in the private plane",
      },
    },
    lanes: [
      {
        laneId: "private_mainline_store",
        label: { zh: "公司主线保存", en: "Company-mainline store" },
        privateResponsibility: {
          zh: "私有面负责追加保存主线事实、冲突键串行化和负责人回执。",
          en: "The private plane persists mainline facts, serializes conflict keys, and stores owner receipts.",
        },
        publicCoreBoundary: {
          zh: "公开 Core 只准备交接包；不保存真实私有主线、不写目标系统、不外发。",
          en: "Public Core only prepares the handoff envelope; it does not persist private mainline facts, write targets, or send externally.",
        },
        bindingRef: privateMainlineStore.binding.bindingRef,
        bindingMode: privateMainlineStore.binding.storeMode,
        handoffStatus: "prepared_handoff_only",
        privatePlaneRequiredForCompletion: true,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
        publicCoreAppliesAsset: false,
      },
      {
        laneId: "owner_notification_dispatcher",
        label: { zh: "负责人通知与升级", en: "Owner notification and escalation" },
        privateResponsibility: {
          zh: "私有面负责解析联系人、发送通知、执行升级策略并保存送达回执。",
          en: "The private plane resolves contacts, sends notifications, applies escalation policy, and persists delivery receipts.",
        },
        publicCoreBoundary: {
          zh: "公开 Core 只传 owner 引用；不保存联系方式、不发送通知、不授予批准。",
          en: "Public Core only carries owner refs; it does not store contact details, send notifications, or grant approval.",
        },
        bindingRef: ownerNotificationDispatcher.binding.bindingRef,
        bindingMode: ownerNotificationDispatcher.binding.dispatcherMode,
        handoffStatus: "prepared_handoff_only",
        privatePlaneRequiredForCompletion: true,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
        publicCoreAppliesAsset: false,
      },
      {
        laneId: "activation_runtime_executor",
        label: { zh: "运行时生效执行", en: "Runtime activation executor" },
        privateResponsibility: {
          zh: "私有面负责解析目标引用、执行生效、保存执行回执并保留回退或更正路径。",
          en: "The private plane resolves target refs, executes activation, stores execution receipts, and keeps rollback or correction paths.",
        },
        publicCoreBoundary: {
          zh: "公开 Core 只验证交接条件；不触发运行时生效、不写目标系统、不保存执行回执。",
          en: "Public Core only verifies handoff conditions; it does not activate runtime paths, write targets, or persist execution receipts.",
        },
        bindingRef: activationRuntimeExecutor.binding.bindingRef,
        bindingMode: activationRuntimeExecutor.binding.executorMode,
        handoffStatus: "prepared_handoff_only",
        privatePlaneRequiredForCompletion: true,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
        publicCoreAppliesAsset: false,
      },
      {
        laneId: "learning_asset_store",
        label: { zh: "经验资产落库与应用", en: "Learning-asset store and application" },
        privateResponsibility: {
          zh: "私有面负责保存经验资产、执行应用策略、记录私有回执和后续检查更新。",
          en: "The private plane stores learning assets, applies policy, records private receipts, and handles later check updates.",
        },
        publicCoreBoundary: {
          zh: "公开 Core 只保留草案和交接形状；不应用经验资产、不修改检查规则、不授予批准。",
          en: "Public Core only keeps the draft and handoff shape; it does not apply learning assets, change check rules, or grant approval.",
        },
        bindingRef: learningAssetStore.binding.bindingRef,
        bindingMode: learningAssetStore.binding.storeMode,
        handoffStatus: "prepared_handoff_only",
        privatePlaneRequiredForCompletion: true,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
        publicCoreAppliesAsset: false,
      },
    ],
    readinessClaim: "not_readiness",
    activationClaim: "not_activation",
    applicationClaim: "not_applied",
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
    appliesAsset: false,
  };
}
