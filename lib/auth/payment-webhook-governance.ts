import { createHash } from "node:crypto";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";
import { db } from "@/lib/db";

export const BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "BILLING_WEBHOOK_TENANCY_RESOLVED",
  "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
  "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
] as const;

export type BillingWebhookGovernanceActionType =
  (typeof BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES)[number];

export type BillingWebhookResolutionSource =
  | "stripe.subscription_id"
  | "stripe.customer_id"
  | "stripe.client_reference_id"
  | "stripe.metadata.workspace_id"
  | "alipay.out_trade_no"
  | "alipay.trade_no"
  | "alipay.passback_params"
  | "wechat.out_trade_no"
  | "wechat.transaction_id";

export type BillingWebhookResolutionFailureReason =
  | "workspace-unresolved"
  | "workspace-hint-conflict"
  | "workspace-authoritative-conflict";

type ResolutionCandidate = {
  workspaceId: string;
  source: BillingWebhookResolutionSource;
};

export type BillingWebhookWorkspaceHint = {
  workspaceId: string | null;
  hintSource: BillingWebhookResolutionSource | null;
};

type CandidateResolution = {
  candidate: ResolutionCandidate | null;
  conflict: boolean;
};

export type BillingWebhookTenancyResolution =
  | {
      resolved: true;
      workspaceId: string;
      actionType: BillingWebhookGovernanceActionType;
      authoritativeSource: BillingWebhookResolutionSource | null;
      hintSource: BillingWebhookResolutionSource | null;
      resolutionSource: BillingWebhookResolutionSource;
      hintWorkspaceId: string | null;
    }
  | {
      resolved: false;
      reason: BillingWebhookResolutionFailureReason;
    };

function getStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getRecordValue(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function resolveWorkspaceCandidateByCheckoutSessionId(
  checkoutSessionId: string | null,
  source: BillingWebhookResolutionSource,
) {
  if (!checkoutSessionId) {
    return { candidate: null, conflict: false } satisfies CandidateResolution;
  }

  const records = await db.billingAccount.findMany({
    where: {
      paymentCheckoutSessionId: checkoutSessionId,
    },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
    take: 2,
  });

  if (records.length > 1) {
    return { candidate: null, conflict: true } satisfies CandidateResolution;
  }

  if (!records.length) {
    return { candidate: null, conflict: false } satisfies CandidateResolution;
  }

  return {
    candidate: {
      workspaceId: records[0].workspaceId,
      source,
    },
    conflict: false,
  } satisfies CandidateResolution;
}

async function resolveWorkspaceCandidateByUniqueField(input: {
  where: {
    paymentSubscriptionId?: string;
    paymentCustomerId?: string;
  };
  source: BillingWebhookResolutionSource;
}) {
  const key = Object.values(input.where)[0];
  if (!key) {
    return { candidate: null, conflict: false } satisfies CandidateResolution;
  }

  const billingAccount = input.where.paymentSubscriptionId
    ? await db.billingAccount.findUnique({
        where: { paymentSubscriptionId: input.where.paymentSubscriptionId },
        select: { workspaceId: true },
      })
    : input.where.paymentCustomerId
      ? await db.billingAccount.findUnique({
          where: { paymentCustomerId: input.where.paymentCustomerId },
          select: { workspaceId: true },
        })
      : null;

  return {
    candidate: billingAccount?.workspaceId
      ? {
          workspaceId: billingAccount.workspaceId,
          source: input.source,
        }
      : null,
    conflict: false,
  } satisfies CandidateResolution;
}

async function resolveWorkspaceHintCandidate(
  workspaceId: string | null,
  source: BillingWebhookResolutionSource,
) {
  if (!workspaceId) {
    return { candidate: null, conflict: false } satisfies CandidateResolution;
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  return {
    candidate: workspace
      ? {
          workspaceId: workspace.id,
          source,
        }
      : null,
    conflict: false,
  } satisfies CandidateResolution;
}

function resolveCandidateGroup(input: CandidateResolution[]) {
  if (input.some((item) => item.conflict)) {
    return { candidate: null, conflict: true } satisfies CandidateResolution;
  }

  const candidates = input
    .map((item) => item.candidate)
    .filter((item): item is ResolutionCandidate => Boolean(item));

  if (candidates.length <= 1) {
    return {
      candidate: candidates[0] ?? null,
      conflict: false,
    } satisfies CandidateResolution;
  }

  const workspaceIds = new Set(candidates.map((item) => item.workspaceId));
  if (workspaceIds.size > 1) {
    return { candidate: null, conflict: true } satisfies CandidateResolution;
  }

  return {
    candidate: candidates[0],
    conflict: false,
  } satisfies CandidateResolution;
}

function finalizeResolution(input: {
  authoritative: CandidateResolution;
  hint: CandidateResolution;
}): BillingWebhookTenancyResolution {
  if (input.authoritative.conflict) {
    return {
      resolved: false,
      reason: "workspace-authoritative-conflict",
    };
  }

  if (input.hint.conflict) {
    return {
      resolved: false,
      reason: "workspace-hint-conflict",
    };
  }

  const authoritative = input.authoritative.candidate;
  const hint = input.hint.candidate;

  if (authoritative) {
    if (hint && hint.workspaceId !== authoritative.workspaceId) {
      return {
        resolved: true,
        workspaceId: authoritative.workspaceId,
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
        authoritativeSource: authoritative.source,
        hintSource: hint.source,
        resolutionSource: authoritative.source,
        hintWorkspaceId: hint.workspaceId,
      };
    }

    return {
      resolved: true,
      workspaceId: authoritative.workspaceId,
      actionType: "BILLING_WEBHOOK_TENANCY_RESOLVED",
      authoritativeSource: authoritative.source,
      hintSource: hint?.source ?? null,
      resolutionSource: authoritative.source,
      hintWorkspaceId: hint?.workspaceId ?? null,
    };
  }

  if (hint) {
    return {
      resolved: true,
      workspaceId: hint.workspaceId,
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
      authoritativeSource: null,
      hintSource: hint.source,
      resolutionSource: hint.source,
      hintWorkspaceId: hint.workspaceId,
    };
  }

  return {
    resolved: false,
    reason: "workspace-unresolved",
  };
}

export async function resolveStripeWebhookTenancy(object: Record<string, unknown>) {
  const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata : null;
  const subscription = await resolveWorkspaceCandidateByUniqueField({
    where: {
      paymentSubscriptionId: getStringValue(object.subscription) ?? getStringValue(object.id) ?? undefined,
    },
    source: "stripe.subscription_id",
  });
  const customer = await resolveWorkspaceCandidateByUniqueField({
    where: {
      paymentCustomerId: getStringValue(object.customer) ?? undefined,
    },
    source: "stripe.customer_id",
  });
  const clientReference = await resolveWorkspaceHintCandidate(
    getStringValue(object.client_reference_id),
    "stripe.client_reference_id",
  );
  const metadataWorkspace = await resolveWorkspaceHintCandidate(
    metadata && "workspaceId" in metadata ? getStringValue(metadata.workspaceId) : null,
    "stripe.metadata.workspace_id",
  );

  return finalizeResolution({
    authoritative: resolveCandidateGroup([subscription, customer]),
    hint: resolveCandidateGroup([clientReference, metadataWorkspace]),
  });
}

export function extractStripeWebhookWorkspaceHint(rawBody: string): BillingWebhookWorkspaceHint {
  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = getRecordValue(payload.data);
    const object = getRecordValue(data?.object);
    const metadata = getRecordValue(object?.metadata);
    const metadataWorkspaceId = getStringValue(metadata?.workspaceId);

    if (metadataWorkspaceId) {
      return {
        workspaceId: metadataWorkspaceId,
        hintSource: "stripe.metadata.workspace_id",
      };
    }

    const clientReferenceId = getStringValue(object?.client_reference_id);
    if (clientReferenceId) {
      return {
        workspaceId: clientReferenceId,
        hintSource: "stripe.client_reference_id",
      };
    }
  } catch {
    return {
      workspaceId: null,
      hintSource: null,
    };
  }

  return {
    workspaceId: null,
    hintSource: null,
  };
}

export async function resolveAlipayNotifyTenancy(input: {
  workspaceIdHint?: string | null;
  outTradeNo?: string | null;
  tradeNo?: string | null;
}) {
  const checkout = await resolveWorkspaceCandidateByCheckoutSessionId(
    input.outTradeNo ?? null,
    "alipay.out_trade_no",
  );
  const trade = await resolveWorkspaceCandidateByUniqueField({
    where: {
      paymentSubscriptionId: input.tradeNo ?? undefined,
    },
    source: "alipay.trade_no",
  });
  const hint = await resolveWorkspaceHintCandidate(
    input.workspaceIdHint ?? null,
    "alipay.passback_params",
  );

  return finalizeResolution({
    authoritative: resolveCandidateGroup([checkout, trade]),
    hint,
  });
}

export function extractAlipayNotifyWorkspaceHint(rawBody: string): BillingWebhookWorkspaceHint {
  const workspaceId = getStringValue(new URLSearchParams(rawBody).get("passback_params"));

  return {
    workspaceId,
    hintSource: workspaceId ? "alipay.passback_params" : null,
  };
}

export async function resolveWeChatPayNotifyTenancy(input: {
  outTradeNo?: string | null;
  transactionId?: string | null;
}) {
  const checkout = await resolveWorkspaceCandidateByCheckoutSessionId(
    input.outTradeNo ?? null,
    "wechat.out_trade_no",
  );
  const transaction = await resolveWorkspaceCandidateByUniqueField({
    where: {
      paymentSubscriptionId: input.transactionId ?? undefined,
    },
    source: "wechat.transaction_id",
  });

  return finalizeResolution({
    authoritative: resolveCandidateGroup([checkout, transaction]),
    hint: { candidate: null, conflict: false },
  });
}

export function buildBillingWebhookGovernanceSummary(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
  actionType: BillingWebhookGovernanceActionType;
  resolutionSource: BillingWebhookResolutionSource;
}) {
  const providerLabel = getBillingWebhookProviderLabel(input.provider);

  if (input.actionType === "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK") {
    return `${providerLabel} callback resolved workspace via fallback hint ${input.resolutionSource}`;
  }

  if (input.actionType === "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH") {
    return `${providerLabel} callback kept authoritative tenant mapping ${input.resolutionSource} after hint mismatch`;
  }

  return `${providerLabel} callback resolved workspace via ${input.resolutionSource}`;
}

export function buildBillingWebhookUnresolvedSummary(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
  reason: BillingWebhookResolutionFailureReason;
}) {
  const providerLabel = getBillingWebhookProviderLabel(input.provider);

  return `${providerLabel} callback remained outside workspace audit because tenant mapping stayed ${input.reason}`;
}

export function buildBillingWebhookVerificationFailureSummary(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
}) {
  const providerLabel = getBillingWebhookProviderLabel(input.provider);

  return `${providerLabel} callback failed authenticity verification before tenant mapping`;
}

export function buildBillingWebhookDuplicateSummary(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
}) {
  const providerLabel = getBillingWebhookProviderLabel(input.provider);

  return `${providerLabel} callback matched an existing governance event and stayed duplicate-only`;
}

export function buildBillingWebhookExceptionSummary(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
}) {
  const providerLabel = getBillingWebhookProviderLabel(input.provider);

  return `${providerLabel} callback resolved tenant scope but failed follow-through processing`;
}

export function buildBillingWebhookUnsupportedSummary(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
}) {
  const providerLabel = getBillingWebhookProviderLabel(input.provider);

  return `${providerLabel} callback was verified but stayed outside supported follow-through scope`;
}

export function buildPaymentWebhookCallbackFingerprint(input: {
  provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER];
  externalEventId?: string | null;
  fingerprintParts?: Array<string | null | undefined>;
  rawBody?: string | null;
}) {
  const candidate =
    input.externalEventId?.trim() ||
    input.fingerprintParts?.filter((value): value is string => Boolean(value && value.trim())).join("::") ||
    input.rawBody ||
    "empty-payload";

  return createHash("sha256").update(`${input.provider}::${candidate}`).digest("hex");
}

function getBillingWebhookProviderLabel(provider: typeof PAYMENT_PROVIDER[keyof typeof PAYMENT_PROVIDER]) {
  const providerLabel =
    provider === PAYMENT_PROVIDER.STRIPE
      ? "Stripe"
      : provider === PAYMENT_PROVIDER.ALIPAY
        ? "Alipay"
        : "WeChat Pay";
  return providerLabel;
}
