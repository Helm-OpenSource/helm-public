import type { AccessState, PaymentProvider } from "@prisma/client";
import { ActorType } from "@prisma/client";
import {
  ADDITIONAL_ACTIVE_SEAT_PRICE_CENTS,
  ensureWorkspaceCommercialFoundation,
  getWorkspaceBillingSnapshot,
  GRACE_DURATION_DAYS,
  ORGANIZATION_BASE_FEE_CENTS,
  syncWorkspaceAccessState,
} from "@/lib/billing/foundation";
import {
  createAlipayCheckoutSession,
  queryAlipayTradeStatus,
} from "@/lib/billing/alipay";
import {
  ChinaPaymentStatusSnapshot,
  getWorkspaceOrderAmountCents,
} from "@/lib/billing/china-payment";
import {
  getChinaDuplicateCheckoutMessage,
  getChinaRefreshMissingOrderMessage,
  getChinaRefreshResultMessage,
} from "@/lib/billing/china-renew-restore";
import {
  canOpenBillingPortal,
  canStartCheckout,
  getAdditionalBillableSeatCount,
} from "@/lib/billing/payment";
import { mapPaymentLifecycle } from "@/lib/billing/payment-lifecycle-mapping";
import { PaymentCallbackEvent } from "@/lib/billing/payment-providers";
import { PaymentRailResolution, resolveWorkspacePaymentRail } from "@/lib/billing/payment-provider-resolver";
import { ACCESS_STATE, PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  createStripeCustomer,
  isStripeBillingPortalConfigured,
  isStripeCheckoutConfigured,
  listStripeSubscriptionsByCustomer,
  retrieveStripeSubscription,
  StripeCheckoutSessionResponse,
  StripeSubscriptionResponse,
} from "@/lib/billing/stripe";
import {
  createWeChatPayCheckoutSession,
  queryWeChatPayOrderStatus,
} from "@/lib/billing/wechat-pay";
import { assertWorkspaceBillingServiceAccess } from "@/lib/auth/service-governance";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";

async function getWorkspaceBillingContext(workspaceId: string) {
  await ensureWorkspaceCommercialFoundation(workspaceId);

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      billingAccount: true,
      trialState: true,
      memberships: {
        where: {
          status: "ACTIVE",
        },
      },
    },
  });

  if (!workspace || !workspace.billingAccount || !workspace.trialState) {
    throw new Error("Workspace billing context is unavailable");
  }

  return {
    ...workspace,
    billingAccount: workspace.billingAccount,
    trialState: workspace.trialState,
  };
}

function isEnglishLocale(locale: string | null | undefined) {
  return locale === "en-US";
}

function getWorkspacePaymentRail(
  workspace: Awaited<ReturnType<typeof getWorkspaceBillingContext>>,
  paymentProvider?: PaymentProvider | null,
) {
  return resolveWorkspacePaymentRail({
    defaultLocale: workspace.defaultLocale,
    paymentProvider: paymentProvider ?? workspace.billingAccount.paymentProvider,
    paymentCustomerId: workspace.billingAccount.paymentCustomerId,
    paymentSubscriptionId: workspace.billingAccount.paymentSubscriptionId,
    paymentSubscriptionStatus: workspace.billingAccount.paymentSubscriptionStatus,
  });
}

function getRequestedRailUnavailableMessage(english: boolean) {
  return english
    ? "This organization cannot use the requested payment rail"
    : "当前组织不能使用所请求的支付通道";
}

function assertRequestedRailAllowed(
  rail: PaymentRailResolution,
  requestedProvider: PaymentProvider | undefined,
  english: boolean,
) {
  if (!requestedProvider) {
    return;
  }

  if (!rail.availableProviders.includes(requestedProvider)) {
    throw new Error(getRequestedRailUnavailableMessage(english));
  }
}

function getCheckoutAvailabilityMessage(rail: PaymentRailResolution, english: boolean) {
  if (rail.provider === PAYMENT_PROVIDER.STRIPE) {
    return english
      ? "Stripe checkout is not configured yet"
      : "Stripe 托管购买还没有配置完成";
  }

  if (rail.provider === PAYMENT_PROVIDER.ALIPAY) {
    return english
      ? "Alipay checkout is not configured yet. This China rail still stays narrow: checkout, notify and lifecycle sync only."
      : "支付宝购买入口还没有配置完成。当前中国区支付通道仍然只做购买、通知和订阅状态同步。";
  }

  return english
    ? "WeChat Pay checkout is not configured yet. This China rail still stays narrow: checkout, notify and lifecycle sync only."
    : "微信支付购买入口还没有配置完成。当前中国区支付通道仍然只做购买、通知和订阅状态同步。";
}

function getPortalAvailabilityMessage(rail: PaymentRailResolution, english: boolean) {
  if (rail.provider === PAYMENT_PROVIDER.STRIPE) {
    return english
      ? "Stripe billing portal is not configured yet"
      : "Stripe 订阅管理入口还没有配置完成";
  }

  return english
    ? "China payment rails do not provide full portal parity in Sprint 1. Subscription management remains a narrow billing overview plus provider-specific checkout / restore flow."
    : "中国区支付通道当前不提供完整订阅门户能力。订阅管理仍保持为一层窄订阅概览，加上对应支付渠道的购买 / 恢复路径。";
}

function getRefreshAvailabilityMessage(rail: PaymentRailResolution, english: boolean) {
  if (rail.provider === PAYMENT_PROVIDER.STRIPE) {
    return english
      ? "Stripe lifecycle sync is not connected yet"
      : "Stripe 生命周期 sync 还没有接通";
  }

    if (rail.provider === PAYMENT_PROVIDER.ALIPAY) {
      return english
        ? "Alipay notify / query sync is not connected yet"
        : "支付宝通知 / 查询同步还没有接通";
    }

    return english
      ? "WeChat Pay notify / query sync is not connected yet"
      : "微信支付通知 / 查询同步还没有接通";
  }

async function upsertStripeCustomerId(input: {
  workspaceId: string;
  customerId: string;
}) {
  await db.billingAccount.update({
    where: { workspaceId: input.workspaceId },
    data: {
      paymentProvider: PAYMENT_PROVIDER.STRIPE,
      paymentCustomerId: input.customerId,
      lastPaymentSyncAt: new Date(),
    },
  });
}

async function ensureWorkspaceStripeCustomer(input: {
  workspaceId: string;
  fallbackEmail: string;
  locale: string;
}) {
  const workspace = await getWorkspaceBillingContext(input.workspaceId);
  const rail = getWorkspacePaymentRail(workspace);

  if (rail.provider !== PAYMENT_PROVIDER.STRIPE) {
    throw new Error(getCheckoutAvailabilityMessage(rail, isEnglishLocale(input.locale)));
  }

  if (workspace.billingAccount.paymentCustomerId) {
    return workspace.billingAccount.paymentCustomerId;
  }

  const customerId = await createStripeCustomer({
    workspaceId: workspace.id,
    organizationName: workspace.name,
    email: input.fallbackEmail,
    locale: input.locale,
  });

  await upsertStripeCustomerId({
    workspaceId: workspace.id,
    customerId,
  });

  return customerId;
}

async function persistStripePaymentStatus(input: {
  workspace: Awaited<ReturnType<typeof getWorkspaceBillingContext>>;
  subscription: StripeSubscriptionResponse;
  sourcePage: string;
  actorName?: string;
  actorType?: ActorType;
  userId?: string | null;
  checkoutSessionId?: string | null;
  fromCheckout?: boolean;
}) {
  const resolution = mapPaymentLifecycle({
    provider: PAYMENT_PROVIDER.STRIPE,
    providerStatus: input.subscription.status,
    currentAccessState: input.workspace.trialState.status,
    currentPeriodStart: input.subscription.current_period_start ?? null,
    currentPeriodEnd: input.subscription.current_period_end ?? null,
    graceDays: GRACE_DURATION_DAYS,
    fromCheckout: input.fromCheckout,
  });

  await db.billingAccount.update({
    where: { workspaceId: input.workspace.id },
    data: {
      paymentProvider: PAYMENT_PROVIDER.STRIPE,
      paymentCustomerId: String(input.subscription.customer),
      paymentSubscriptionId: input.subscription.id,
      paymentSubscriptionStatus: input.subscription.status,
      paymentCheckoutSessionId:
        input.checkoutSessionId ?? input.workspace.billingAccount.paymentCheckoutSessionId,
      paymentCheckoutCompletedAt: resolution.shouldRecordCheckoutCompletion
        ? new Date()
        : input.workspace.billingAccount.paymentCheckoutCompletedAt,
      billingPeriodStartsAt: resolution.billingPeriodStartsAt ?? undefined,
      billingPeriodEndsAt: resolution.billingPeriodEndsAt ?? undefined,
      billingStatus: resolution.nextBillingStatus,
      lastPaymentSyncAt: new Date(),
    },
  });

  await db.trialState.update({
    where: { workspaceId: input.workspace.id },
    data: {
      status: resolution.nextTrialStateStatus,
      trialEndsAt: resolution.billingPeriodEndsAt ?? input.workspace.trialState.trialEndsAt,
      graceEndsAt: resolution.graceEndsAt ?? input.workspace.trialState.graceEndsAt,
    },
  });

  const accessState = await syncWorkspaceAccessState(input.workspace.id);

  await writeAuditLog({
    workspaceId: input.workspace.id,
    userId: input.userId ?? undefined,
    actor: input.actorName ?? "Stripe",
    actorType: input.actorType ?? ActorType.SYSTEM,
    actionType: "BILLING_STATUS_SYNCED",
    targetType: "BillingAccount",
    targetId: input.workspace.billingAccount.id,
    summary: `Synced billing status for ${input.workspace.name}: ${input.subscription.status} -> ${accessState ?? resolution.nextTrialStateStatus}`,
    payload: {
      provider: "stripe",
      subscriptionStatus: input.subscription.status,
      accessState: accessState ?? resolution.nextTrialStateStatus,
      subscriptionId: input.subscription.id,
      customerId: String(input.subscription.customer),
    },
    sourcePage: input.sourcePage,
  });

  return {
    accessState: accessState ?? resolution.nextTrialStateStatus,
    provider: PAYMENT_PROVIDER.STRIPE,
    providerStatus: input.subscription.status,
    subscriptionId: input.subscription.id,
    customerId: String(input.subscription.customer),
    lifecycleSourceConnected: true,
    message: undefined,
  };
}

async function persistChinaPaymentStatus(input: {
  workspace: Awaited<ReturnType<typeof getWorkspaceBillingContext>>;
  statusSnapshot: ChinaPaymentStatusSnapshot;
  sourcePage: string;
  actorName?: string;
  actorType?: ActorType;
  userId?: string | null;
  fromCheckout?: boolean;
}) {
  const resolution = mapPaymentLifecycle({
    provider: input.statusSnapshot.provider,
    providerStatus: input.statusSnapshot.providerStatus,
    currentAccessState: input.workspace.trialState.status,
    currentPeriodStart: input.statusSnapshot.currentPeriodStart ?? null,
    currentPeriodEnd: input.statusSnapshot.currentPeriodEnd ?? null,
    graceDays: GRACE_DURATION_DAYS,
    fromCheckout: input.fromCheckout,
  });

  await db.billingAccount.update({
    where: { workspaceId: input.workspace.id },
    data: {
      paymentProvider: input.statusSnapshot.provider,
      paymentCustomerId:
        input.statusSnapshot.customerId ?? input.workspace.billingAccount.paymentCustomerId,
      paymentSubscriptionId:
        input.statusSnapshot.subscriptionId ?? input.workspace.billingAccount.paymentSubscriptionId,
      paymentSubscriptionStatus: input.statusSnapshot.providerStatus,
      paymentCheckoutSessionId: input.statusSnapshot.checkoutSessionId,
      paymentCheckoutCompletedAt: resolution.shouldRecordCheckoutCompletion
        ? new Date()
        : input.workspace.billingAccount.paymentCheckoutCompletedAt,
      billingPeriodStartsAt: resolution.billingPeriodStartsAt ?? input.workspace.billingAccount.billingPeriodStartsAt,
      billingPeriodEndsAt: resolution.billingPeriodEndsAt ?? input.workspace.billingAccount.billingPeriodEndsAt,
      billingStatus: resolution.nextBillingStatus,
      lastPaymentSyncAt: new Date(),
    },
  });

  const shouldAdvanceWindow = resolution.nextTrialStateStatus === ACCESS_STATE.ACTIVE;
  const shouldAdvanceState = resolution.nextTrialStateStatus !== input.workspace.trialState.status;

  if (shouldAdvanceWindow || shouldAdvanceState) {
    await db.trialState.update({
      where: { workspaceId: input.workspace.id },
      data: {
        status: resolution.nextTrialStateStatus,
        trialEndsAt: shouldAdvanceWindow
          ? resolution.billingPeriodEndsAt ?? input.workspace.trialState.trialEndsAt
          : input.workspace.trialState.trialEndsAt,
        graceEndsAt: resolution.graceEndsAt ?? input.workspace.trialState.graceEndsAt,
      },
    });
  }

  const accessState = await syncWorkspaceAccessState(input.workspace.id);

  await writeAuditLog({
    workspaceId: input.workspace.id,
    userId: input.userId ?? undefined,
    actor:
      input.actorName ??
      (input.statusSnapshot.provider === PAYMENT_PROVIDER.ALIPAY ? "Alipay" : "WeChat Pay"),
    actorType: input.actorType ?? ActorType.SYSTEM,
    actionType: "BILLING_STATUS_SYNCED",
    targetType: "BillingAccount",
    targetId: input.workspace.billingAccount.id,
    summary: `Synced billing status for ${input.workspace.name}: ${input.statusSnapshot.providerStatus ?? "unknown"} -> ${accessState ?? resolution.nextTrialStateStatus}`,
    payload: {
      provider: input.statusSnapshot.provider.toLowerCase(),
      subscriptionStatus: input.statusSnapshot.providerStatus,
      accessState: accessState ?? resolution.nextTrialStateStatus,
      checkoutSessionId: input.statusSnapshot.checkoutSessionId,
      subscriptionId: input.statusSnapshot.subscriptionId ?? null,
      customerId: input.statusSnapshot.customerId ?? null,
    },
    sourcePage: input.sourcePage,
  });

  return {
    accessState: accessState ?? resolution.nextTrialStateStatus,
    provider: input.statusSnapshot.provider,
    providerStatus: input.statusSnapshot.providerStatus,
    subscriptionId: input.statusSnapshot.subscriptionId ?? null,
    customerId: input.statusSnapshot.customerId ?? null,
    lifecycleSourceConnected: true,
    message: getChinaRefreshResultMessage({
      accessState: accessState ?? resolution.nextTrialStateStatus,
      provider: input.statusSnapshot.provider,
      providerStatus: input.statusSnapshot.providerStatus,
      english: isEnglishLocale(input.workspace.defaultLocale),
    }),
  };
}

async function resolveStripeSubscriptionForWorkspace(input: {
  workspaceId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  if (input.subscriptionId) {
    return retrieveStripeSubscription(input.subscriptionId);
  }

  if (input.customerId) {
    const listed = await listStripeSubscriptionsByCustomer(input.customerId);
    return listed.data[0] ?? null;
  }

  const billingAccount = await db.billingAccount.findUnique({
    where: { workspaceId: input.workspaceId },
    select: {
      paymentCustomerId: true,
      paymentSubscriptionId: true,
    },
  });

  if (billingAccount?.paymentSubscriptionId) {
    return retrieveStripeSubscription(billingAccount.paymentSubscriptionId);
  }

  if (billingAccount?.paymentCustomerId) {
    const listed = await listStripeSubscriptionsByCustomer(billingAccount.paymentCustomerId);
    return listed.data[0] ?? null;
  }

  return null;
}

async function resolveChinaPaymentStatusForWorkspace(input: {
  workspace: Awaited<ReturnType<typeof getWorkspaceBillingContext>>;
  provider: PaymentProvider;
  checkoutSessionId?: string | null;
}) {
  const checkoutSessionId =
    input.checkoutSessionId ?? input.workspace.billingAccount.paymentCheckoutSessionId;

  if (!checkoutSessionId) {
    return null;
  }

  if (input.provider === PAYMENT_PROVIDER.ALIPAY) {
    return queryAlipayTradeStatus(checkoutSessionId);
  }

  return queryWeChatPayOrderStatus(checkoutSessionId);
}

function getStripeSubscriptionFromSession(session: StripeCheckoutSessionResponse) {
  return typeof session.subscription === "string" ? session.subscription : null;
}

export async function createWorkspaceCheckoutSession(input: {
  workspaceId: string;
  userId: string;
  actorName: string;
  fallbackEmail: string;
  locale: string;
  paymentProvider?: PaymentProvider;
  clientIp?: string | null;
  userAgent?: string | null;
}) {
  await assertWorkspaceBillingServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: ActorType.USER,
    english: isEnglishLocale(input.locale),
    scope: "checkout",
  });

  const workspace = await getWorkspaceBillingContext(input.workspaceId);
  const snapshot = await getWorkspaceBillingSnapshot(input.workspaceId);
  const rail = getWorkspacePaymentRail(workspace, input.paymentProvider);
  const english = isEnglishLocale(input.locale);

  assertRequestedRailAllowed(rail, input.paymentProvider, english);

  if (
    !canStartCheckout({
      accessState: snapshot.accessState,
      paymentSubscriptionStatus: workspace.billingAccount.paymentSubscriptionStatus,
    })
  ) {
    throw new Error(
      rail.provider === PAYMENT_PROVIDER.ALIPAY || rail.provider === PAYMENT_PROVIDER.WECHAT_PAY
        ? getChinaDuplicateCheckoutMessage({ english })
        : english
          ? "This organization already has active paid access. Use the current management path instead of starting duplicate checkout."
          : "当前组织已经有活跃付费访问权，请不要重复购买，先使用当前管理路径。",
    );
  }

  if (!rail.checkoutConfigured) {
    throw new Error(getCheckoutAvailabilityMessage(rail, english));
  }

  if (rail.provider === PAYMENT_PROVIDER.STRIPE) {
    if (!isStripeCheckoutConfigured()) {
      throw new Error(getCheckoutAvailabilityMessage(rail, english));
    }

    const customerId = await ensureWorkspaceStripeCustomer({
      workspaceId: workspace.id,
      fallbackEmail: input.fallbackEmail,
      locale: input.locale,
    });

    const checkout = await createStripeCheckoutSession({
      workspaceId: workspace.id,
      userId: input.userId,
      organizationName: workspace.name,
      email: input.fallbackEmail,
      locale: input.locale,
      accessState: snapshot.accessState,
      customerId,
      activeSeatCount: snapshot.activeSeatCount,
      includedAdminSeats: workspace.billingAccount.includedAdminSeats,
    });

    await db.billingAccount.update({
      where: { workspaceId: workspace.id },
      data: {
        paymentProvider: PAYMENT_PROVIDER.STRIPE,
        paymentCustomerId: customerId,
        paymentCheckoutSessionId: checkout.id,
        lastPaymentSyncAt: new Date(),
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: input.userId,
      actor: input.actorName,
      actorType: ActorType.USER,
      actionType: "BILLING_CHECKOUT_CREATED",
      targetType: "BillingAccount",
      targetId: workspace.billingAccount.id,
      summary: `Started Helm Team checkout for ${workspace.name} via Stripe`,
      payload: {
        provider: "stripe",
        workspaceId: workspace.id,
        activeSeatCount: snapshot.activeSeatCount,
        additionalBillableSeats: getAdditionalBillableSeatCount(
          snapshot.activeSeatCount,
          workspace.billingAccount.includedAdminSeats,
        ),
        baseFeeCents: ORGANIZATION_BASE_FEE_CENTS,
        activeSeatPriceCents: ADDITIONAL_ACTIVE_SEAT_PRICE_CENTS,
        checkoutSessionId: checkout.id,
      },
      sourcePage: "/settings",
    });

    if (!checkout.url) {
      throw new Error("Stripe checkout session did not return a redirect URL");
    }

    return checkout.url;
  }

  const additionalBillableSeats = getAdditionalBillableSeatCount(
    snapshot.activeSeatCount,
    workspace.billingAccount.includedAdminSeats,
  );

  const chinaInput = {
    provider: rail.provider,
    workspaceId: workspace.id,
    userId: input.userId,
    organizationName: workspace.name,
    currentPlan: workspace.billingAccount.currentPlan,
    locale: input.locale,
    accessState: snapshot.accessState,
    activeSeatCount: snapshot.activeSeatCount,
    includedAdminSeats: workspace.billingAccount.includedAdminSeats,
    additionalBillableSeats,
    baseFeeCents: workspace.billingAccount.baseFeeCents,
    activeSeatPriceCents: workspace.billingAccount.activeSeatPriceCents,
    clientIp: input.clientIp ?? null,
    userAgent: input.userAgent ?? null,
  };

  const checkout =
    rail.provider === PAYMENT_PROVIDER.ALIPAY
      ? await createAlipayCheckoutSession({
          ...chinaInput,
          provider: PAYMENT_PROVIDER.ALIPAY,
        })
      : await createWeChatPayCheckoutSession({
          ...chinaInput,
          provider: PAYMENT_PROVIDER.WECHAT_PAY,
        });

  await db.billingAccount.update({
    where: { workspaceId: workspace.id },
    data: {
      paymentProvider: rail.provider,
      paymentCheckoutSessionId: checkout.checkoutSessionId,
      paymentSubscriptionStatus: null,
      lastPaymentSyncAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "BILLING_CHECKOUT_CREATED",
    targetType: "BillingAccount",
    targetId: workspace.billingAccount.id,
    summary: `Started Helm Team checkout for ${workspace.name} via ${rail.provider === PAYMENT_PROVIDER.ALIPAY ? "Alipay" : "WeChat Pay"}`,
    payload: {
      provider: rail.provider.toLowerCase(),
      workspaceId: workspace.id,
      currentPlan: workspace.billingAccount.currentPlan,
      accessState: snapshot.accessState,
      activeSeatCount: snapshot.activeSeatCount,
      additionalBillableSeats,
      orderAmountCents: getWorkspaceOrderAmountCents({
        baseFeeCents: workspace.billingAccount.baseFeeCents,
        activeSeatPriceCents: workspace.billingAccount.activeSeatPriceCents,
        additionalBillableSeats,
      }),
      checkoutSessionId: checkout.checkoutSessionId,
      checkoutMode: checkout.checkoutMode,
    },
    sourcePage: "/settings",
  });

  return checkout.url;
}

export async function createWorkspaceBillingPortalSession(input: {
  workspaceId: string;
  userId: string;
  actorName: string;
  english?: boolean;
}) {
  await assertWorkspaceBillingServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: ActorType.USER,
    english: input.english ?? false,
    scope: "portal",
  });

  const workspace = await getWorkspaceBillingContext(input.workspaceId);
  const rail = getWorkspacePaymentRail(workspace);
  const english = isEnglishLocale(workspace.defaultLocale);

  if (
    rail.provider !== PAYMENT_PROVIDER.STRIPE ||
    rail.billingPortalMode !== "STRIPE_PORTAL" ||
    !rail.portalConfigured ||
    !isStripeBillingPortalConfigured()
  ) {
    throw new Error(getPortalAvailabilityMessage(rail, english));
  }

  if (
    !canOpenBillingPortal({
      paymentCustomerId: workspace.billingAccount.paymentCustomerId,
      paymentProviderConfigured: rail.portalConfigured,
      billingPortalMode: rail.billingPortalMode,
    })
  ) {
    throw new Error("This organization does not have a live billing customer yet. Start checkout first.");
  }

  const portal = await createStripeBillingPortalSession({
    customerId: workspace.billingAccount.paymentCustomerId!,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "BILLING_PORTAL_OPENED",
    targetType: "BillingAccount",
    targetId: workspace.billingAccount.id,
    summary: `Opened hosted billing portal for ${workspace.name}`,
    sourcePage: "/settings",
  });

  return portal.url;
}

export async function syncWorkspacePaymentStatus(input: {
  workspaceId: string;
  actorName?: string;
  actorType?: ActorType;
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  checkoutSessionId?: string | null;
  sourcePage?: string | null;
  fromCheckout?: boolean;
  english?: boolean;
}) {
  await assertWorkspaceBillingServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    english: input.english ?? false,
    scope: "refresh",
  });

  const workspace = await getWorkspaceBillingContext(input.workspaceId);
  const rail = getWorkspacePaymentRail(workspace);

  if (!rail.lifecycleSourceConnected) {
    return {
      accessState: await syncWorkspaceAccessState(workspace.id),
      provider: rail.provider,
      providerStatus: workspace.billingAccount.paymentSubscriptionStatus,
      lifecycleSourceConnected: rail.lifecycleSourceConnected,
      message: getRefreshAvailabilityMessage(rail, isEnglishLocale(workspace.defaultLocale)),
    };
  }

  if (rail.provider === PAYMENT_PROVIDER.STRIPE) {
    const subscription = await resolveStripeSubscriptionForWorkspace({
      workspaceId: workspace.id,
      customerId: input.customerId,
      subscriptionId: input.subscriptionId,
    });

    if (!subscription) {
      return {
        accessState: await syncWorkspaceAccessState(workspace.id),
        provider: rail.provider,
        providerStatus: workspace.billingAccount.paymentSubscriptionStatus,
        lifecycleSourceConnected: rail.lifecycleSourceConnected,
        message: undefined,
      };
    }

    return persistStripePaymentStatus({
      workspace,
      subscription,
      actorName: input.actorName,
      actorType: input.actorType,
      userId: input.userId,
      checkoutSessionId: input.checkoutSessionId,
      sourcePage: input.sourcePage ?? "/settings",
      fromCheckout: input.fromCheckout,
    });
  }

  const statusSnapshot = await resolveChinaPaymentStatusForWorkspace({
    workspace,
    provider: rail.provider,
    checkoutSessionId: input.checkoutSessionId ?? null,
  });

  if (!statusSnapshot) {
    return {
      accessState: await syncWorkspaceAccessState(workspace.id),
      provider: rail.provider,
      providerStatus: workspace.billingAccount.paymentSubscriptionStatus,
      lifecycleSourceConnected: rail.lifecycleSourceConnected,
      message: getChinaRefreshMissingOrderMessage({
        accessState: workspace.trialState.status,
        english: isEnglishLocale(workspace.defaultLocale),
      }),
    };
  }

  return persistChinaPaymentStatus({
    workspace,
    statusSnapshot,
    actorName: input.actorName,
    actorType: input.actorType,
    userId: input.userId,
    sourcePage: input.sourcePage ?? "/settings",
    fromCheckout: input.fromCheckout,
  });
}

export async function syncWorkspacePaymentStatusFromCheckoutSession(input: {
  workspaceId: string;
  checkoutSession: StripeCheckoutSessionResponse;
}) {
  const subscriptionId = getStripeSubscriptionFromSession(input.checkoutSession);

  return syncWorkspacePaymentStatus({
    workspaceId: input.workspaceId,
    customerId:
      typeof input.checkoutSession.customer === "string" ? input.checkoutSession.customer : null,
    subscriptionId,
    checkoutSessionId: input.checkoutSession.id,
    sourcePage: "/api/billing/stripe/webhook",
    fromCheckout: true,
  });
}

export async function syncWorkspacePaymentStatusFromCallbackEvent(input: {
  workspaceId: string;
  event: PaymentCallbackEvent;
}) {
  if (input.event.provider === PAYMENT_PROVIDER.STRIPE) {
    return syncWorkspacePaymentStatus({
      workspaceId: input.workspaceId,
      customerId: input.event.customerId ?? null,
      subscriptionId: input.event.subscriptionId ?? null,
      checkoutSessionId: input.event.checkoutSessionId ?? null,
      sourcePage: "/api/billing/stripe/webhook",
      fromCheckout: input.event.fromCheckout,
    });
  }

  const workspace = await getWorkspaceBillingContext(input.workspaceId);

  return persistChinaPaymentStatus({
    workspace,
    statusSnapshot: {
      provider: input.event.provider,
      checkoutSessionId:
        input.event.checkoutSessionId ??
        workspace.billingAccount.paymentCheckoutSessionId ??
        "",
      providerStatus: input.event.providerStatus ?? null,
      subscriptionId: input.event.subscriptionId ?? null,
      customerId: input.event.customerId ?? null,
      currentPeriodStart: input.event.currentPeriodStart ?? null,
      currentPeriodEnd: input.event.currentPeriodEnd ?? null,
    },
    sourcePage:
      input.event.provider === PAYMENT_PROVIDER.ALIPAY
        ? "/api/billing/alipay/notify"
        : "/api/billing/wechat-pay/notify",
    actorName:
      input.event.provider === PAYMENT_PROVIDER.ALIPAY ? "Alipay" : "WeChat Pay",
    actorType: ActorType.SYSTEM,
    fromCheckout: input.event.fromCheckout,
  });
}

export function getBillingOverviewActionState(input: {
  accessState: AccessState;
  checkoutConfigured: boolean;
  portalConfigured: boolean;
  lifecycleSourceConnected: boolean;
  billingPortalMode: "STRIPE_PORTAL" | "NONE_YET";
  paymentCustomerId: string | null;
  paymentSubscriptionStatus: string | null;
}) {
  const checkoutReady =
    input.checkoutConfigured &&
    canStartCheckout({
      accessState: input.accessState,
      paymentSubscriptionStatus: input.paymentSubscriptionStatus,
    });
  const portalReady = canOpenBillingPortal({
    paymentCustomerId: input.paymentCustomerId,
    paymentProviderConfigured: input.portalConfigured,
    billingPortalMode: input.billingPortalMode,
  });

  return {
    checkoutReady,
    portalReady,
    refreshReady: input.lifecycleSourceConnected,
  };
}
