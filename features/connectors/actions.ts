"use server";

import { ActorType, ConnectorProvider, ConnectorStatus, UsageType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import {
  getAliyunFounderDefaultCredentialsMissingMessage,
  getDingTalkAgentIdMissingMessage,
} from "@/features/connectors/action-copy";
import {
  canManageWorkspaceConnectors,
  getConnectorManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  DINGTALK_READONLY_INGEST_AUDIT_ACTIONS,
  fetchDingTalkAppAccessToken,
  getDingTalkAppMessageConfig,
  parseDingTalkConnectorMetadata,
} from "@/lib/connectors/dingtalk";
import {
  FEISHU_READONLY_INGEST_AUDIT_ACTIONS,
} from "@/lib/connectors/feishu";
import { syncFeishuReadonlyConnector } from "@/lib/connectors/feishu-ingestion";
import {
  getLatestDingTalkDirectoryInviteDryRunSnapshot,
  patchLatestDingTalkDirectoryInviteDryRunSnapshotDetails,
  persistDingTalkDirectoryInviteSnapshot,
} from "@/lib/connectors/dingtalk-directory-invite-snapshot";
import {
  resolveDingTalkDirectoryInviteDryRun,
  sendDingTalkInviteMessage,
  syncAndInviteDingTalkDirectory,
} from "@/lib/connectors/dingtalk-directory-invite";
import { syncDingTalkReadonlyConnector } from "@/lib/connectors/dingtalk-ingestion";
import {
  configureAliyunMailConnector,
  getAliyunFounderDefaultCredentials,
  sendAliyunMailFromConnector,
  syncGmailConnector,
  syncMockGmailConnector,
} from "@/lib/connectors/google";
import {
  WECOM_CALENDAR_REGISTRY_AUDIT_ACTIONS,
  WECOM_READONLY_INGEST_AUDIT_ACTIONS,
  validateAndPersistWeComCalendarRegistry,
} from "@/lib/connectors/wecom";
import { syncWeComReadonlyConnector } from "@/lib/connectors/wecom-ingestion";

export async function syncGmailConnectorAction() {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });
  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: workspace.id,
        userId: user.id,
        provider: ConnectorProvider.GMAIL,
      },
    },
  });

  if (!connector) {
    return {
      ok: false,
      error: english ? "No Aliyun Mail connection is available yet. Connect an account first." : "当前还没有阿里邮箱连接，请先连接账号。",
    };
  }

  try {
    const result =
      connector.smtpPassword
        ? await syncGmailConnector(connector.id)
        : await syncMockGmailConnector({
            workspaceId: workspace.id,
            userId: user.id,
            connectorId: connector.id,
            accountEmail: connector.externalAccountEmail ?? user.email,
          });
    revalidatePath("/settings");
    revalidatePath("/inbox");
    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "GMAIL",
        connectorId: connector.id,
      },
    });
    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "CONNECTOR_SYNC_COMPLETED",
      targetType: "Connector",
      targetId: connector.id,
      summary: `Completed Aliyun Mail connector sync for ${connector.externalAccountEmail ?? user.email}`,
      payload: {
        provider: connector.provider,
        usedMock: result.usedMock,
        syncedThreads: result.syncedThreads,
        syncedMessages: result.syncedMessages,
      },
      sourcePage: "/settings",
    });
    return {
      ok: true,
      message: result.usedMock
        ? (english ? "Local mock Aliyun Mail data synced" : "已同步本地 mock 阿里邮箱数据")
        : (english ? "Aliyun Mail sync completed" : "阿里邮箱已完成同步"),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Aliyun Mail sync failed" : "阿里邮箱同步失败",
    };
  }
}

export async function connectMockGmailAction() {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });
  const result = await syncMockGmailConnector({
    workspaceId: workspace.id,
    userId: user.id,
    accountEmail: user.email,
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "connector_connected",
    eventCategory: "connector",
    targetType: "Connector",
    targetId: result.connector.id,
    metadata: {
      provider: result.connector.provider,
      usedMock: true,
      externalAccountEmail: result.connector.externalAccountEmail,
    },
    sourcePage: "/settings",
  });
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONNECTOR_CONNECTED",
    targetType: "Connector",
    targetId: result.connector.id,
    summary: `Connected Aliyun Mail mock connector for ${result.connector.externalAccountEmail ?? user.email}`,
    payload: {
      provider: result.connector.provider,
      usedMock: true,
      externalAccountEmail: result.connector.externalAccountEmail,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/inbox");
  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    userId: user.id,
    usageType: UsageType.CONNECTOR_SYNC,
    sourcePage: "/settings",
    metadata: {
      provider: result.connector.provider,
      connectorId: result.connector.id,
      usedMock: true,
    },
  });
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONNECTOR_SYNC_COMPLETED",
    targetType: "Connector",
    targetId: result.connector.id,
    summary: `Completed Aliyun Mail mock sync for ${result.connector.externalAccountEmail ?? user.email}`,
    payload: {
      provider: result.connector.provider,
      usedMock: true,
      syncedThreads: result.syncedThreads,
      syncedMessages: result.syncedMessages,
    },
    sourcePage: "/settings",
  });

  return {
    ok: true,
  };
}

export async function connectAliyunMailConnectorAction(input: {
  email: string;
  password: string;
  manualSendEnabled?: boolean;
}) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  const email = input.email.trim();
  const password = input.password.trim();

  if (!email.includes("@")) {
    return {
      ok: false,
      error: english ? "Please enter a valid email account." : "请输入有效邮箱账号。",
    };
  }

  if (!password) {
    return {
      ok: false,
      error: english ? "Please provide the Aliyun Mail client password." : "请输入阿里邮箱客户端专用密码。",
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });

  const manualSendEnabled = input.manualSendEnabled ?? false;
  const connector = await configureAliyunMailConnector({
    workspaceId: workspace.id,
    userId: user.id,
    email,
    password,
    manualSendEnabled,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONNECTOR_CONNECTED",
    targetType: "Connector",
    targetId: connector.id,
    summary: `Connected Aliyun Mail connector for ${email}`,
    payload: {
      provider: connector.provider,
      externalAccountEmail: email,
      authMode: "aliyun-client-password",
      manualSendEnabled,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/inbox");

  return {
    ok: true,
    message: english ? "Aliyun Mail account connected" : "阿里邮箱账号已连接",
  };
}

export async function connectAliyunFounderDefaultAction(input?: { locale?: string | null }) {
  const defaults = getAliyunFounderDefaultCredentials();
  const english = input?.locale === "en-US";

  if (!defaults.email || !defaults.password) {
    return {
      ok: false,
      error: getAliyunFounderDefaultCredentialsMissingMessage(english),
    };
  }

  return connectAliyunMailConnectorAction({
    email: defaults.email,
    password: defaults.password,
    manualSendEnabled: false,
  });
}

export async function sendAliyunMailManualAction(input: {
  to: string;
  subject: string;
  text: string;
}) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: workspace.id,
        userId: user.id,
        provider: ConnectorProvider.GMAIL,
      },
    },
  });

  if (!connector) {
    return {
      ok: false,
      error: english ? "Connect Aliyun Mail before sending." : "请先连接阿里邮箱后再发送。",
    };
  }

  if (!input.to.trim() || !input.subject.trim() || !input.text.trim()) {
    return {
      ok: false,
      error: english ? "To, subject, and body are required." : "收件人、主题和正文不能为空。",
    };
  }

  const result = await sendAliyunMailFromConnector({
    connectorId: connector.id,
    to: input.to.trim(),
    subject: input.subject.trim(),
    text: input.text.trim(),
    explicitUserTrigger: true,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MANUAL_EMAIL_SEND",
    targetType: "Connector",
    targetId: connector.id,
    summary: `Manual Aliyun Mail send to ${input.to.trim()} with subject ${input.subject.trim()}`,
    payload: {
      provider: connector.provider,
      to: input.to.trim(),
      subject: input.subject.trim(),
      messageId: result.messageId,
      mailProvider: "ALIYUN",
      boundary: "manual-explicit-send-only",
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");

  return {
    ok: true,
    message: english ? "Manual email sent successfully" : "邮件已手动发送成功",
  };
}

export async function disconnectConnectorAction(provider: ConnectorProvider) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: workspace.id,
        userId: user.id,
        provider,
      },
    },
  });

  if (!connector) {
    return {
      ok: false,
      error: english ? "Connector not found" : "连接器不存在",
    };
  }

  await db.connector.update({
    where: { id: connector.id },
    data: {
      status: ConnectorStatus.DISCONNECTED,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      smtpPassword: null,
      lastSyncStatus: english ? "Disconnected" : "已断开连接",
      lastSyncMessage: english ? "The account has been disconnected. Previously synced inbox data remains available." : "账号已断开，收件箱会继续保留已同步的数据。",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/inbox");
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONNECTOR_DISCONNECTED",
    targetType: "Connector",
    targetId: connector.id,
    summary: `Disconnected ${provider} connector for ${connector.externalAccountEmail ?? user.email}`,
    payload: {
      provider,
    },
    sourcePage: "/settings",
  });

  return {
    ok: true,
  };
}

function getDingTalkReadonlyIngestAuditAction(status: string) {
  switch (status) {
    case "SUCCESS":
      return DINGTALK_READONLY_INGEST_AUDIT_ACTIONS.SUCCESS;
    case "PARTIAL":
      return DINGTALK_READONLY_INGEST_AUDIT_ACTIONS.PARTIAL;
    case "UNRESOLVED":
      return DINGTALK_READONLY_INGEST_AUDIT_ACTIONS.UNRESOLVED;
    default:
      return DINGTALK_READONLY_INGEST_AUDIT_ACTIONS.FAILURE;
  }
}

function getWeComReadonlyIngestAuditAction(status: string) {
  switch (status) {
    case "SUCCESS":
      return WECOM_READONLY_INGEST_AUDIT_ACTIONS.SUCCESS;
    case "PARTIAL":
      return WECOM_READONLY_INGEST_AUDIT_ACTIONS.PARTIAL;
    case "UNRESOLVED":
      return WECOM_READONLY_INGEST_AUDIT_ACTIONS.UNRESOLVED;
    default:
      return WECOM_READONLY_INGEST_AUDIT_ACTIONS.FAILURE;
  }
}

function getWeComCalendarRegistryAuditAction(status: string) {
  switch (status) {
    case "SUCCESS":
      return WECOM_CALENDAR_REGISTRY_AUDIT_ACTIONS.SUCCESS;
    case "PARTIAL":
      return WECOM_CALENDAR_REGISTRY_AUDIT_ACTIONS.PARTIAL;
    case "UNRESOLVED":
      return WECOM_CALENDAR_REGISTRY_AUDIT_ACTIONS.UNRESOLVED;
    default:
      return WECOM_CALENDAR_REGISTRY_AUDIT_ACTIONS.FAILURE;
  }
}

function getFeishuReadonlyIngestAuditAction(status: string) {
  switch (status) {
    case "SUCCESS":
      return FEISHU_READONLY_INGEST_AUDIT_ACTIONS.SUCCESS;
    case "PARTIAL":
      return FEISHU_READONLY_INGEST_AUDIT_ACTIONS.PARTIAL;
    case "UNRESOLVED":
      return FEISHU_READONLY_INGEST_AUDIT_ACTIONS.UNRESOLVED;
    default:
      return FEISHU_READONLY_INGEST_AUDIT_ACTIONS.FAILURE;
  }
}

export async function syncDingTalkConnectorAction() {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });

  try {
    const result = await syncDingTalkReadonlyConnector({
      workspaceId: workspace.id,
      userId: user.id,
      english,
      sourcePage: "/settings",
      triggeredBy: user.name,
    });

    revalidatePath("/settings");

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "DINGTALK",
        connectorId: result.connectorId,
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
      },
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "connector_sync_triggered",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: result.connectorId,
      metadata: {
        provider: "DINGTALK",
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        unresolvedScopes: result.ingestResult.scopeResults
          .filter((scope) => scope.status !== "INGESTED")
          .map((scope) => scope.scope),
      },
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: getDingTalkReadonlyIngestAuditAction(result.status),
      targetType: "Connector",
      targetId: result.connectorId,
      summary:
        result.status === "SUCCESS"
          ? english
            ? "Completed DingTalk read-only ingest"
            : "完成了钉钉只读采集"
          : result.status === "PARTIAL"
            ? english
              ? "Completed DingTalk read-only ingest with unresolved scopes"
              : "完成了带未解析授权范围的钉钉只读采集"
            : result.status === "UNRESOLVED"
              ? english
                ? "Recorded DingTalk read-only ingest unresolved posture"
                : "记录了钉钉只读采集未解析姿态"
              : english
                ? "Recorded DingTalk read-only ingest failure posture"
                : "记录了钉钉只读采集失败姿态",
      payload: {
        provider: "DINGTALK",
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        ingestionRecordCount: result.ingestResult.ingestionRecordCount,
        handleCount: result.ingestResult.handleCount,
        runtimeEventId: result.ingestResult.runtimeEventId,
        runtimeSessionId: result.ingestResult.runtimeSessionId,
        notebookId: result.ingestResult.notebookId,
        scopeResults: result.ingestResult.scopeResults,
      },
      sourcePage: "/settings",
    });

    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      return {
        ok: true,
        message:
          result.ingestResult.message ??
          (english
            ? "DingTalk read-only ingest completed"
            : "钉钉只读采集已完成"),
      };
    }

    return {
      ok: false,
      error:
        result.ingestResult.message ??
        (english
          ? "DingTalk read-only ingest remains unresolved"
          : "钉钉只读采集仍未解析"),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "DingTalk read-only ingest failed"
            : "钉钉只读采集失败",
    };
  }
}

export async function syncFeishuConnectorAction() {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });

  try {
    const result = await syncFeishuReadonlyConnector({
      workspaceId: workspace.id,
      userId: user.id,
      english,
      sourcePage: "/settings",
      triggeredBy: user.name,
    });

    revalidatePath("/settings");

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "FEISHU",
        connectorId: result.connectorId,
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
      },
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "connector_sync_triggered",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: result.connectorId,
      metadata: {
        provider: "FEISHU",
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        unresolvedScopes: result.ingestResult.scopeResults
          .filter((scope) => scope.status !== "INGESTED")
          .map((scope) => scope.scope),
      },
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: getFeishuReadonlyIngestAuditAction(result.status),
      targetType: "Connector",
      targetId: result.connectorId,
      summary:
        result.status === "SUCCESS"
          ? english
            ? "Completed Feishu Bitable read-only ingest"
            : "完成了飞书多维表格只读采集"
          : result.status === "PARTIAL"
            ? english
              ? "Completed Feishu Bitable read-only ingest with unresolved scopes"
              : "完成了带未解析范围的飞书多维表格只读采集"
            : result.status === "UNRESOLVED"
              ? english
                ? "Recorded Feishu Bitable read-only ingest unresolved posture"
                : "记录了飞书多维表格只读采集未解析姿态"
              : english
                ? "Recorded Feishu Bitable read-only ingest failure posture"
                : "记录了飞书多维表格只读采集失败姿态",
      payload: {
        provider: "FEISHU",
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        ingestionRecordCount: result.ingestResult.ingestionRecordCount,
        handleCount: result.ingestResult.handleCount,
        runtimeEventId: result.ingestResult.runtimeEventId,
        runtimeSessionId: result.ingestResult.runtimeSessionId,
        notebookId: result.ingestResult.notebookId,
        scopeResults: result.ingestResult.scopeResults,
      },
      sourcePage: "/settings",
    });

    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      return {
        ok: true,
        message:
          result.ingestResult.message ??
          (english
            ? "Feishu Bitable read-only ingest completed"
            : "飞书多维表格只读采集已完成"),
      };
    }

    return {
      ok: false,
      error:
        result.ingestResult.message ??
        (english
          ? "Feishu Bitable read-only ingest remains unresolved"
          : "飞书多维表格只读采集仍未解析"),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Feishu Bitable read-only ingest failed"
            : "飞书多维表格只读采集失败",
    };
  }
}

export async function syncAndInviteDingTalkDirectoryAction(input?: {
  dryRun?: boolean;
  deptIds?: number[];
  maxUsers?: number;
}) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });

  try {
    const dryRun = resolveDingTalkDirectoryInviteDryRun(input?.dryRun);
    const confirmation = dryRun
      ? undefined
      : {
          confirmedByUserId: user.id,
          confirmedAt: new Date(),
          sourcePage: "/settings",
          traceId: `dingtalk-directory-invite:${workspace.id}:${Date.now()}`,
        };
    const result = await syncAndInviteDingTalkDirectory({
      workspaceId: workspace.id,
      operator: user.name,
      dryRun,
      confirmation,
      deptIds: input?.deptIds,
      maxUsers: input?.maxUsers,
    });

    const summary = english
      ? `Processed ${result.processed} users, created ${result.createdUsers}, reused ${result.reusedUsers}, membership upserts ${result.upsertedMemberships}, messages sent ${result.sentMessages}, skipped ${result.skipped} (no mobile: ${result.skippedNoMobile}), collisions handled ${result.nameCollisionResolved}, errors ${result.errors.length}.`
      : `处理 ${result.processed} 人，新增账号 ${result.createdUsers}，复用账号 ${result.reusedUsers}，写入成员 ${result.upsertedMemberships}，发送钉钉邀请 ${result.sentMessages}，跳过 ${result.skipped}（缺手机号 ${result.skippedNoMobile}），同名冲突处理 ${result.nameCollisionResolved}，错误 ${result.errors.length}。`;

    const existingConnector = await db.connector.findUnique({
      where: {
        workspaceId_userId_provider: {
          workspaceId: workspace.id,
          userId: user.id,
          provider: ConnectorProvider.DINGTALK,
        },
      },
    });
    if (existingConnector) {
      const existingMetadata = parseDingTalkConnectorMetadata(
        existingConnector.metadata,
      );
      await db.connector.update({
        where: {
          id: existingConnector.id,
        },
        data: {
          metadata: JSON.stringify({
            ...existingMetadata,
            lastDirectoryInviteDryRunSnapshot: dryRun
              ? {
                  recordedAt: new Date().toISOString(),
                  processed: result.processed,
                  createdUsers: result.createdUsers,
                  reusedUsers: result.reusedUsers,
                  upsertedMemberships: result.upsertedMemberships,
                  sentMessages: result.sentMessages,
                  skipped: result.skipped,
                  skippedNoMobile: result.skippedNoMobile,
                  nameCollisionResolved: result.nameCollisionResolved,
                  errors: result.errors,
                  details: result.details,
                }
              : existingMetadata.lastDirectoryInviteDryRunSnapshot,
          }),
        },
      });
    }

    try {
      await persistDingTalkDirectoryInviteSnapshot({
        workspaceId: workspace.id,
        operatorUserId: user.id,
        operatorName: user.name,
        dryRun,
        result,
      });
    } catch (snapshotError) {
      const message =
        snapshotError instanceof Error
          ? snapshotError.message
          : String(snapshotError);
      result.errors.push(`snapshot persist failed: ${message}`);
    }

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "DINGTALK",
        action: "DIRECTORY_INVITE_SYNC",
        dryRun,
        processed: result.processed,
        createdUsers: result.createdUsers,
        upsertedMemberships: result.upsertedMemberships,
        sentMessages: result.sentMessages,
        skipped: result.skipped,
        result,
      },
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "dingtalk_directory_invite_sync_triggered",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: "DINGTALK_DIRECTORY_INVITE_SYNC",
      metadata: {
        dryRun,
        ok: result.ok,
        processed: result.processed,
        createdUsers: result.createdUsers,
        reusedUsers: result.reusedUsers,
        upsertedMemberships: result.upsertedMemberships,
        sentMessages: result.sentMessages,
        skipped: result.skipped,
        skippedNoMobile: result.skippedNoMobile,
        nameCollisionResolved: result.nameCollisionResolved,
        errorCount: result.errors.length,
      },
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: result.ok
        ? "DINGTALK_DIRECTORY_INVITE_SYNC_SUCCEEDED"
        : "DINGTALK_DIRECTORY_INVITE_SYNC_PARTIAL",
      targetType: "Connector",
      targetId: "DINGTALK_DIRECTORY_INVITE_SYNC",
      summary,
      payload: {
        dryRun,
        confirmation: confirmation
          ? {
              confirmedByUserId: confirmation.confirmedByUserId,
              confirmedAt: confirmation.confirmedAt.toISOString(),
              sourcePage: confirmation.sourcePage,
              traceId: confirmation.traceId,
            }
          : null,
        result,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");

    if (!result.ok) {
      return {
        ok: false,
        error: result.errors[0] ?? (english ? "DingTalk directory invite sync failed." : "钉钉目录邀请同步失败。"),
        message: summary,
        result,
      };
    }

    return {
      ok: true,
      message: summary,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "DingTalk directory invite sync failed."
            : "钉钉目录邀请同步失败。",
    };
  }
}

export async function inviteDingTalkDirectoryUsersAction(input: {
  dingtalkUserIds: string[];
}) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }
  try {
    await ensureWorkspaceProcessingAllowed({
      workspaceId: workspace.id,
      english,
      operation: "CONNECTOR_SYNC",
    });

    const requestedUserIds = [...new Set(input.dingtalkUserIds.map((value) => value.trim()).filter(Boolean))];
    if (!requestedUserIds.length) {
      return {
        ok: false,
        error: english ? "Please select at least one employee." : "请至少选择一位员工。",
      };
    }

    const snapshot = await getLatestDingTalkDirectoryInviteDryRunSnapshot(workspace.id);
    if (!snapshot || !snapshot.details.length) {
      return {
        ok: false,
        error: english ? "No dry-run detail found for invite." : "未找到可邀请的 dry-run 明细。",
      };
    }

    const config = getDingTalkAppMessageConfig();
    if (!config.agentId) {
      return {
        ok: false,
        error: getDingTalkAgentIdMissingMessage(english),
      };
    }

    const appToken = await fetchDingTalkAppAccessToken();
    const appUrl = process.env.APP_URL?.trim() || "";
    const organizationName = workspace.name?.trim() || "Helm";
    const buildInviteUrl = (title?: string | null) => {
      const normalizedTitle = title?.trim();
      if (appUrl) {
        const url = new URL("/api/public-auth/dingtalk/start", appUrl);
        url.searchParams.set("org", organizationName);
        url.searchParams.set("ws", workspace.id);
        if (normalizedTitle) {
          url.searchParams.set("title", normalizedTitle);
        }
        return url.toString();
      }

      const params = new URLSearchParams({
        org: organizationName,
        ws: workspace.id,
      });
      if (normalizedTitle) {
        params.set("title", normalizedTitle);
      }
      return `/api/public-auth/dingtalk/start?${params.toString()}`;
    };
    const detailByUserId = new Map(
      snapshot.details.map((item) => [item.dingtalkUserId, item] as const),
    );
    const selectedDetails = requestedUserIds
      .map((userId) => detailByUserId.get(userId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!selectedDetails.length) {
      return {
        ok: false,
        error: english ? "Selected users are not in the latest dry-run detail." : "所选员工不在最新 dry-run 明细中。",
      };
    }

    let invited = 0;
    let readCount = 0;
    let unreadCount = 0;
    let pendingCount = 0;
    const failed: Array<{ dingtalkUserId: string; reason: string }> = [];
    const updates: Array<{
      dingtalkUserId: string;
      messageStatus: "SENT" | "FAILED";
      membershipStatus?: "ACTIVE_KEPT" | "INVITED_UPSERTED";
      note?: string | null;
    }> = [];

    for (const detail of selectedDetails) {
      try {
        const receipt = await sendDingTalkInviteMessage({
          accessToken: appToken.accessToken,
          agentId: config.agentId,
          dingtalkUserId: detail.dingtalkUserId,
          workspaceName: workspace.name,
          inviteUrl: buildInviteUrl(detail.title),
          roleLabel: "MEMBER",
          title: detail.title,
        });
        const receiptNoteParts = [
          receipt.taskId ? `task=${receipt.taskId}` : null,
          receipt.readUserIds.length ? `read=${receipt.readUserIds.join(",")}` : null,
          receipt.unreadUserIds.length ? `unread=${receipt.unreadUserIds.join(",")}` : null,
          receipt.forbiddenReasons.length
            ? `forbidden_list=${receipt.forbiddenReasons.join("|")}`
            : null,
          receipt.deliveryNote ? receipt.deliveryNote : null,
        ].filter(Boolean);

        invited += 1;
        readCount += receipt.readUserIds.length;
        unreadCount += receipt.unreadUserIds.length;
        if (receipt.deliveryNote?.startsWith("result_pending")) {
          pendingCount += 1;
        }
        updates.push({
          dingtalkUserId: detail.dingtalkUserId,
          messageStatus: "SENT",
          membershipStatus:
            detail.membershipStatus === "ACTIVE_KEPT"
              ? "ACTIVE_KEPT"
              : "INVITED_UPSERTED",
          note: receiptNoteParts.length ? receiptNoteParts.join("; ") : null,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failed.push({
          dingtalkUserId: detail.dingtalkUserId,
          reason,
        });
        updates.push({
          dingtalkUserId: detail.dingtalkUserId,
          messageStatus: "FAILED",
          note: reason,
        });
      }
    }

    await patchLatestDingTalkDirectoryInviteDryRunSnapshotDetails({
      workspaceId: workspace.id,
      updates,
    });

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "DINGTALK",
        action: "DIRECTORY_INVITE_SEND_SELECTED",
        requestedCount: selectedDetails.length,
        invitedCount: invited,
        failedCount: failed.length,
        failed,
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: failed.length
        ? "DINGTALK_DIRECTORY_INVITE_SYNC_PARTIAL"
        : "DINGTALK_DIRECTORY_INVITE_SYNC_SUCCEEDED",
      targetType: "Connector",
      targetId: "DINGTALK_DIRECTORY_INVITE_SEND_SELECTED",
      summary: english
        ? `Sent or resent ${invited} DingTalk invites from selected users, failed ${failed.length}.`
        : `从所选员工发送或重发钉钉邀请 ${invited} 条，失败 ${failed.length} 条。`,
      payload: {
        selectedUserIds: selectedDetails.map((item) => item.dingtalkUserId),
        invited,
        failed,
        updates,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");

    if (failed.length > 0) {
      return {
        ok: false,
        error:
          failed[0]?.reason ??
          (english ? "Some invites failed." : "部分邀请发送失败。"),
        result: {
          requested: selectedDetails.length,
          invited,
          failed,
        },
      };
    }

    return {
      ok: true,
      message: english
        ? `DingTalk accepted ${invited} invite(s) (read ${readCount}, unread ${unreadCount}, pending ${pendingCount}).`
        : `钉钉已受理邀请 ${invited} 位员工（已读 ${readCount}，未读 ${unreadCount}，结果处理中 ${pendingCount}）。`,
      result: {
        requested: selectedDetails.length,
        invited,
        failed,
      },
    };
  } catch (error) {
    console.error("[connectors] inviteDingTalkDirectoryUsersAction failed", {
      workspaceId: workspace.id,
      requestedCount: input.dingtalkUserIds.length,
      error,
    });
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : english
            ? "DingTalk invite action failed."
            : "钉钉邀请操作失败。",
    };
  }
}

export async function syncWeComConnectorAction() {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });

  try {
    const result = await syncWeComReadonlyConnector({
      workspaceId: workspace.id,
      userId: user.id,
      english,
      sourcePage: "/settings",
      triggeredBy: user.name,
    });

    revalidatePath("/settings");

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "WECOM",
        connectorId: result.connectorId,
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
      },
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "connector_sync_triggered",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: result.connectorId,
      metadata: {
        provider: "WECOM",
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        unresolvedScopes: result.ingestResult.scopeResults
          .filter((scope) => scope.status !== "INGESTED")
          .map((scope) => scope.scope),
      },
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: getWeComReadonlyIngestAuditAction(result.status),
      targetType: "Connector",
      targetId: result.connectorId,
      summary:
        result.status === "SUCCESS"
          ? english
            ? "Completed WeCom read-only ingest"
            : "完成了企业微信只读采集"
          : result.status === "PARTIAL"
            ? english
              ? "Completed WeCom read-only ingest with unresolved scopes"
              : "完成了带未解析授权范围的企业微信只读采集"
            : result.status === "UNRESOLVED"
              ? english
                ? "Recorded WeCom read-only ingest unresolved posture"
                : "记录了企业微信只读采集未解析姿态"
              : english
                ? "Recorded WeCom read-only ingest failure posture"
                : "记录了企业微信只读采集失败姿态",
      payload: {
        provider: "WECOM",
        ingestStatus: result.status,
        persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        ingestionRecordCount: result.ingestResult.ingestionRecordCount,
        handleCount: result.ingestResult.handleCount,
        runtimeEventId: result.ingestResult.runtimeEventId,
        runtimeSessionId: result.ingestResult.runtimeSessionId,
        notebookId: result.ingestResult.notebookId,
        scopeResults: result.ingestResult.scopeResults,
      },
      sourcePage: "/settings",
    });

    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      return {
        ok: true,
        message:
          result.ingestResult.message ??
          (english
            ? "WeCom read-only ingest completed"
            : "企业微信只读采集已完成"),
      };
    }

    return {
      ok: false,
      error:
        result.ingestResult.message ??
        (english
          ? "WeCom read-only ingest remains unresolved"
          : "企业微信只读采集仍未解析"),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "WeCom read-only ingest failed"
            : "企业微信只读采集失败",
    };
  }
}

export async function validateWeComCalendarRegistryAction(calendarIdsText: string) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceConnectors(session.membership.role)) {
    return {
      ok: false,
      error: getConnectorManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CONNECTOR_SYNC",
  });

  try {
    const result = await validateAndPersistWeComCalendarRegistry({
      workspaceId: workspace.id,
      userId: user.id,
      calendarIdsText,
      english,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");

    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CONNECTOR_SYNC,
      sourcePage: "/settings",
      metadata: {
        provider: "WECOM",
        connectorId: result.connectorId,
        registryStatus: result.status,
        boundCalendarCount: result.boundCalendars.length,
      },
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "connector_registry_validated",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: result.connectorId,
      metadata: {
        provider: "WECOM",
        registryStatus: result.status,
        requestedCalendarCount: result.validationResult.requestedCalendarCount,
        boundCalendarCount: result.validationResult.verifiedCalendarCount,
      },
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: getWeComCalendarRegistryAuditAction(result.status),
      targetType: "Connector",
      targetId: result.connectorId,
      summary:
        result.status === "SUCCESS"
          ? english
            ? "Validated WeCom calendar registry"
            : "完成了企业微信日历注册表校验"
          : result.status === "PARTIAL"
            ? english
              ? "Validated WeCom calendar registry with failures"
              : "完成了带失败项的企业微信日历注册表校验"
            : result.status === "UNRESOLVED"
              ? english
                ? "Recorded WeCom calendar registry unresolved posture"
                : "记录了企业微信日历注册表未解析姿态"
              : english
                ? "Recorded WeCom calendar registry failure posture"
                : "记录了企业微信日历注册表失败姿态",
      payload: {
        provider: "WECOM",
        registryStatus: result.status,
        requestedCalendarCount: result.validationResult.requestedCalendarCount,
        verifiedCalendarCount: result.validationResult.verifiedCalendarCount,
        failedCalendarCount: result.validationResult.failedCalendarCount,
        latestVerifiedCalendarId: result.validationResult.latestVerifiedCalendarId,
      },
      sourcePage: "/settings",
    });

    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      return {
        ok: true,
        message:
          result.validationResult.message ??
          (english
            ? "WeCom calendar registry validated"
            : "企业微信日历注册表已校验"),
      };
    }

    return {
      ok: false,
      error:
        result.validationResult.message ??
        (english
          ? "WeCom calendar registry remains unresolved"
          : "企业微信日历注册表仍未解析"),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "WeCom calendar registry validation failed"
            : "企业微信日历注册表校验失败",
    };
  }
}
