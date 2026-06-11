import { createHash } from "node:crypto";
import { ConnectorProvider, ConnectorStatus, RecordSource, ThreadStatus } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { subDays } from "date-fns";
import { logEvent } from "@/lib/analytics";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { db } from "@/lib/db";
import { readConnectorToken, storeConnectorToken } from "@/lib/connectors/token-store";

const GOOGLE_STATE_COOKIE = "helm-google-oauth-state";
const MAIL_LOOKBACK_DAYS = 30;
const DEFAULT_IMAP_HOST = "imap.qiye.aliyun.com";
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_SMTP_HOST = "smtp.qiye.aliyun.com";
const DEFAULT_SMTP_PORT = 465;

export type AliyunMailServerConfig = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

export type AliyunFounderDefaultCredentials = {
  email: string | null;
  password: string | null;
};

type NormalizedMessage = {
  externalMessageId: string;
  sender: string;
  senderEmail: string;
  body: string;
  snippet: string;
  isInbound: boolean;
  sentAt: Date;
  participants: string[];
};

type NormalizedThread = {
  externalThreadId: string;
  subject: string;
  counterpart: string;
  summary: string;
  participants: string[];
  status: ThreadStatus;
  waitingOn: string;
  shouldReply: boolean;
  updatedAt: Date;
  messages: NormalizedMessage[];
};

type AliyunSyncMetadata = {
  mode?: "mock" | "aliyun-live";
  transport?: "imap";
  lastSyncWindowDays?: number;
  lastSendResult?: {
    status: "SUCCESS" | "FAILED";
    at: string;
    message: string;
  };
};

type ParsedImapMessage = {
  uid: number;
  subject: string;
  sentAt: Date;
  sender: string;
  senderEmail: string;
  participants: string[];
  body: string;
  snippet: string;
};

export function getGoogleStateCookieName() {
  return GOOGLE_STATE_COOKIE;
}

export function getAliyunMailServerConfig(): AliyunMailServerConfig {
  return {
    imapHost: process.env.ALIYUN_MAIL_IMAP_HOST?.trim() || DEFAULT_IMAP_HOST,
    imapPort: Number(process.env.ALIYUN_MAIL_IMAP_PORT || DEFAULT_IMAP_PORT),
    imapSecure: process.env.ALIYUN_MAIL_IMAP_SECURE?.trim() === "0" ? false : true,
    smtpHost: process.env.ALIYUN_MAIL_SMTP_HOST?.trim() || DEFAULT_SMTP_HOST,
    smtpPort: Number(process.env.ALIYUN_MAIL_SMTP_PORT || DEFAULT_SMTP_PORT),
    smtpSecure: process.env.ALIYUN_MAIL_SMTP_SECURE?.trim() === "0" ? false : true,
  };
}

export function getAliyunFounderDefaultCredentials(): AliyunFounderDefaultCredentials {
  return {
    email: process.env.ALIYUN_MAIL_FOUNDER_EMAIL?.trim() || null,
    password: process.env.ALIYUN_MAIL_FOUNDER_PASSWORD?.trim() || null,
  };
}

export function isAliyunMailConfigured() {
  const config = getAliyunMailServerConfig();
  return Boolean(config.imapHost && config.smtpHost && config.imapPort > 0 && config.smtpPort > 0);
}

export function parseAliyunConnectorMetadata(metadata?: string | null): AliyunSyncMetadata {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata) as AliyunSyncMetadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function ensureManualSendAllowed(input: { explicitUserTrigger: boolean }) {
  if (!input.explicitUserTrigger) {
    throw new Error("Manual email send requires explicit user trigger.");
  }
}

export function isGoogleOauthConfigured() {
  return false;
}

export function buildGoogleAuthUrl(_state: string): string {
  throw new Error("Google OAuth connector has been replaced by Aliyun Mail credentials flow.");
}

export async function exchangeGoogleCode(_code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  throw new Error("Google OAuth connector has been replaced by Aliyun Mail credentials flow.");
}

export async function fetchGoogleAccountEmail(_accessToken: string): Promise<string | null> {
  throw new Error("Google OAuth connector has been replaced by Aliyun Mail credentials flow.");
}

export async function upsertGmailConnectorFromOauth(_input: {
  workspaceId: string;
  userId: string;
  externalAccountEmail: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
}): Promise<{
  id: string;
  workspaceId: string;
  userId: string;
  provider: ConnectorProvider;
}> {
  throw new Error("Google OAuth connector has been replaced by Aliyun Mail credentials flow.");
}

function normalizeAddress(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSubject(subject: string) {
  const cleaned = (subject || "").trim() || "未命名线程";
  return cleaned.replace(/^(re|fw|fwd)\s*:\s*/gi, "").trim() || "未命名线程";
}

function toDisplayName(name: string | undefined, fallbackEmail: string) {
  return (name || "").trim() || fallbackEmail || "未知联系人";
}

function flattenAddresses(value: unknown): Array<{ address?: string; name?: string }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenAddresses(item));
  }
  if (typeof value === "object" && value !== null) {
    if ("value" in value && Array.isArray((value as { value?: unknown }).value)) {
      return (value as { value: Array<{ address?: string; name?: string }> }).value;
    }
    return [value as { address?: string; name?: string }];
  }
  return [];
}

function makeThreadId(subject: string, participants: string[]) {
  const key = `${normalizeSubject(subject)}::${participants.sort().join(",")}`;
  return `aliyun-thread-${createHash("sha1").update(key).digest("hex").slice(0, 24)}`;
}

async function resolveThreadAssociations(workspaceId: string, accountEmail: string, participants: string[]) {
  const externalEmails = participants.filter((email) => email !== accountEmail.toLowerCase());
  const contact = externalEmails.length
    ? await db.contact.findFirst({
        where: {
          workspaceId,
          email: {
            in: externalEmails,
          },
        },
        include: {
          opportunities: {
            where: {
              stage: {
                notIn: ["DONE", "LOST"],
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
            take: 1,
          },
        },
      })
    : null;

  const company =
    contact?.companyId
      ? await db.company.findUnique({
          where: { id: contact.companyId },
        })
      : null;

  const opportunity =
    contact?.opportunities[0] ??
    (company
      ? await db.opportunity.findFirst({
          where: {
            workspaceId,
            companyId: company.id,
            stage: {
              notIn: ["DONE", "LOST"],
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        })
      : null);

  return {
    contactId: contact?.id ?? null,
    companyId: company?.id ?? null,
    opportunityId: opportunity?.id ?? null,
  };
}

async function upsertNormalizedThread(input: {
  workspaceId: string;
  accountEmail: string;
  thread: NormalizedThread;
}) {
  const associations = await resolveThreadAssociations(
    input.workspaceId,
    input.accountEmail,
    input.thread.participants,
  );

  const thread = await db.emailThread.upsert({
    where: {
      workspaceId_externalThreadId: {
        workspaceId: input.workspaceId,
        externalThreadId: input.thread.externalThreadId,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      contactId: associations.contactId ?? undefined,
      companyId: associations.companyId ?? undefined,
      opportunityId: associations.opportunityId ?? undefined,
      subject: input.thread.subject,
      counterpart: input.thread.counterpart,
      summary: input.thread.summary,
      participants: JSON.stringify(input.thread.participants),
      source: RecordSource.GMAIL,
      externalThreadId: input.thread.externalThreadId,
      status: input.thread.status,
      waitingOn: input.thread.waitingOn,
      shouldReply: input.thread.shouldReply,
      updatedAt: input.thread.updatedAt,
    },
    update: {
      contactId: associations.contactId ?? undefined,
      companyId: associations.companyId ?? undefined,
      opportunityId: associations.opportunityId ?? undefined,
      subject: input.thread.subject,
      counterpart: input.thread.counterpart,
      summary: input.thread.summary,
      participants: JSON.stringify(input.thread.participants),
      source: RecordSource.GMAIL,
      status: input.thread.status,
      waitingOn: input.thread.waitingOn,
      shouldReply: input.thread.shouldReply,
      updatedAt: input.thread.updatedAt,
    },
  });

  for (const message of input.thread.messages) {
    await db.emailMessage.upsert({
      where: {
        threadId_externalMessageId: {
          threadId: thread.id,
          externalMessageId: message.externalMessageId,
        },
      },
      create: {
        threadId: thread.id,
        sender: message.sender,
        senderEmail: message.senderEmail,
        body: message.body,
        snippet: message.snippet,
        source: RecordSource.GMAIL,
        externalMessageId: message.externalMessageId,
        isInbound: message.isInbound,
        sentAt: message.sentAt,
      },
      update: {
        sender: message.sender,
        senderEmail: message.senderEmail,
        body: message.body,
        snippet: message.snippet,
        source: RecordSource.GMAIL,
        isInbound: message.isInbound,
        sentAt: message.sentAt,
      },
    });
  }
}

function buildThreadFromMessages(accountEmail: string, messages: ParsedImapMessage[]): NormalizedThread {
  const sorted = [...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const latest = sorted[sorted.length - 1];
  const participants = Array.from(new Set(sorted.flatMap((item) => item.participants))).sort();
  const externalThreadId = makeThreadId(latest.subject, participants);
  const externalParticipants = participants.filter((item) => item !== normalizeAddress(accountEmail));
  const counterpartEmail = externalParticipants[0] || latest.senderEmail;

  const normalizedMessages: NormalizedMessage[] = sorted.map((message) => ({
    externalMessageId: `aliyun-imap-${message.uid}`,
    sender: message.sender,
    senderEmail: message.senderEmail,
    body: message.body,
    snippet: message.snippet,
    isInbound: message.senderEmail !== normalizeAddress(accountEmail),
    sentAt: message.sentAt,
    participants: message.participants,
  }));

  const latestMessage = normalizedMessages[normalizedMessages.length - 1];

  return {
    externalThreadId,
    subject: normalizeSubject(latest.subject),
    counterpart: toDisplayName(latest.sender, counterpartEmail),
    summary: latestMessage.snippet || latestMessage.body || normalizeSubject(latest.subject),
    participants,
    status: latestMessage.isInbound ? ThreadStatus.WAITING_US : ThreadStatus.WAITING_THEM,
    waitingOn: latestMessage.isInbound ? "我方" : "对方",
    shouldReply: latestMessage.isInbound,
    updatedAt: latestMessage.sentAt,
    messages: normalizedMessages,
  };
}

function groupMessagesIntoThreads(accountEmail: string, messages: ParsedImapMessage[]) {
  const groups = new Map<string, ParsedImapMessage[]>();

  for (const message of messages) {
    const participantsKey = Array.from(new Set(message.participants)).sort().join(",");
    const key = `${normalizeSubject(message.subject)}::${participantsKey}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(message);
    groups.set(key, bucket);
  }

  return Array.from(groups.values()).map((group) => buildThreadFromMessages(accountEmail, group));
}

async function fetchImapMessages(input: {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
}) {
  const client = new ImapFlow({
    host: input.imapHost,
    port: input.imapPort,
    secure: input.imapSecure,
    auth: {
      user: input.email,
      pass: input.password,
    },
    logger: false,
  });

  await client.connect();

  try {
    await client.mailboxOpen("INBOX");
    const sinceDate = subDays(new Date(), MAIL_LOOKBACK_DAYS);
    const searchResult = await client.search({ since: sinceDate });
    const uids = Array.isArray(searchResult) ? searchResult : [];
    const recentUids = uids.slice(-80);

    const parsed: ParsedImapMessage[] = [];

    for await (const fetched of client.fetch(recentUids, { uid: true, source: true, envelope: true, internalDate: true })) {
      if (!fetched.source) {
        continue;
      }

      const source = Buffer.isBuffer(fetched.source)
        ? fetched.source
        : Buffer.from(fetched.source as Uint8Array);
      const mail = await simpleParser(source);

      const fromAddressObject = flattenAddresses(mail.from)[0];
      const fromAddress = fromAddressObject?.address || fetched.envelope?.from?.[0]?.address || input.email;
      const fromName = fromAddressObject?.name || fetched.envelope?.from?.[0]?.name || "";
      const recipients = [
        ...flattenAddresses(mail.to),
        ...flattenAddresses(mail.cc),
        ...flattenAddresses(mail.bcc),
      ]
        .map((item) => normalizeAddress(item.address))
        .filter(Boolean);
      const participants = Array.from(new Set([normalizeAddress(fromAddress), ...recipients])).filter(Boolean);
      const text = (mail.text || mail.html || "").toString().trim();

      parsed.push({
        uid: fetched.uid,
        subject: mail.subject || fetched.envelope?.subject || "未命名线程",
        sentAt: new Date(fetched.internalDate || mail.date || Date.now()),
        sender: toDisplayName(fromName, fromAddress),
        senderEmail: normalizeAddress(fromAddress),
        participants,
        body: text,
        snippet: text.slice(0, 260),
      });
    }

    return parsed;
  } finally {
    // If the fetch loop threw because the connection died, logout() will throw
    // too and would mask the original error (and leak the socket). Fall back to
    // a forced close so the original error propagates and the socket is freed.
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

export async function configureAliyunMailConnector(input: {
  workspaceId: string;
  userId: string;
  email: string;
  password: string;
  manualSendEnabled?: boolean;
}) {
  const config = getAliyunMailServerConfig();
  const now = new Date();

  return db.connector.upsert({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.GMAIL,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: ConnectorProvider.GMAIL,
      status: ConnectorStatus.CONNECTED,
      externalAccountEmail: input.email.trim(),
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      imapSecure: config.imapSecure,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUsername: input.email.trim(),
      smtpPassword: storeConnectorToken(input.password),
      manualSendEnabled: input.manualSendEnabled ?? false,
      metadata: JSON.stringify({
        mode: "aliyun-live",
        transport: "imap",
        configuredAt: now.toISOString(),
      }),
      lastSyncStatus: "阿里邮箱已连接，等待同步",
      lastSyncMessage: null,
    },
    update: {
      status: ConnectorStatus.CONNECTED,
      externalAccountEmail: input.email.trim(),
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      imapSecure: config.imapSecure,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUsername: input.email.trim(),
      smtpPassword: storeConnectorToken(input.password),
      manualSendEnabled: input.manualSendEnabled ?? false,
      metadata: JSON.stringify({
        ...parseAliyunConnectorMetadata((await db.connector.findUnique({ where: { workspaceId_userId_provider: { workspaceId: input.workspaceId, userId: input.userId, provider: ConnectorProvider.GMAIL } } }))?.metadata),
        mode: "aliyun-live",
        transport: "imap",
        configuredAt: now.toISOString(),
      }),
      lastSyncStatus: "阿里邮箱已连接，等待同步",
      lastSyncMessage: null,
    },
  });
}

export async function syncGmailConnector(connectorId: string) {
  const connector = await db.connector.findUnique({ where: { id: connectorId } });

  if (!connector) {
    throw new Error("连接器不存在");
  }

  const accountEmail = connector.externalAccountEmail?.trim();
  const password = readConnectorToken(connector.smtpPassword);
  const imapHost = connector.imapHost || getAliyunMailServerConfig().imapHost;
  const imapPort = connector.imapPort || getAliyunMailServerConfig().imapPort;
  const imapSecure = connector.imapSecure ?? getAliyunMailServerConfig().imapSecure;

  if (!accountEmail || !password) {
    throw new Error("阿里邮箱凭据缺失，请重新连接邮箱账号。");
  }

  try {
    const messages = await fetchImapMessages({
      email: accountEmail,
      password,
      imapHost,
      imapPort,
      imapSecure,
    });

    const threads = groupMessagesIntoThreads(accountEmail, messages);

    for (const thread of threads) {
      await upsertNormalizedThread({
        workspaceId: connector.workspaceId,
        accountEmail,
        thread,
      });
    }

    const updated = await db.connector.update({
      where: { id: connector.id },
      data: {
        status: ConnectorStatus.CONNECTED,
        lastSyncedAt: new Date(),
        lastSyncStatus: "同步完成",
        lastSyncMessage: `最近 ${MAIL_LOOKBACK_DAYS} 天共同步 ${threads.length} 条线程、${messages.length} 封邮件。`,
        metadata: JSON.stringify({
          ...parseAliyunConnectorMetadata(connector.metadata),
          mode: "aliyun-live",
          transport: "imap",
          lastSyncWindowDays: MAIL_LOOKBACK_DAYS,
        }),
      },
    });

    await logEvent({
      workspaceId: updated.workspaceId,
      userId: updated.userId,
      eventName: "connector_sync_triggered",
      eventCategory: "connector",
      targetType: "Connector",
      targetId: updated.id,
      metadata: {
        provider: updated.provider,
        syncedThreads: threads.length,
        syncedMessages: messages.length,
        mailProvider: "ALIYUN",
      },
      sourcePage: "/settings",
    });

    return {
      connector: updated,
      syncedThreads: threads.length,
      syncedMessages: messages.length,
      usedMock: false,
    };
  } catch (error) {
    await db.connector.update({
      where: { id: connector.id },
      data: {
        status: ConnectorStatus.ERROR,
        lastSyncStatus: "同步失败",
        // IMAP/SMTP error text can echo auth material; redact before it lands in
        // a user-visible connector status field.
        lastSyncMessage: redactProviderErrorBody(
          error instanceof Error ? error.message : "未知错误",
        ),
      },
    });
    throw error;
  }
}

function buildMockThreads(accountEmail: string): NormalizedThread[] {
  const now = new Date();

  return [
    {
      externalThreadId: "mock-aliyun-thread-1",
      subject: "Acme 采购评估下一步",
      counterpart: "Vivian Chen",
      summary: "Vivian 想在本周内确认试点边界和报价结构。",
      participants: [accountEmail.toLowerCase(), "vivian@acme.demo"],
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      updatedAt: subDays(now, 1),
      messages: [
        {
          externalMessageId: "mock-aliyun-message-1",
          sender: "Vivian Chen",
          senderEmail: "vivian@acme.demo",
          body: "我们内部已经过了一轮评估，能否把试点范围和报价拆开再发一版？",
          snippet: "能否把试点范围和报价拆开再发一版？",
          isInbound: true,
          sentAt: subDays(now, 1),
          participants: [accountEmail.toLowerCase(), "vivian@acme.demo"],
        },
      ],
    },
    {
      externalThreadId: "mock-aliyun-thread-2",
      subject: "候选人 Leo 终面协调",
      counterpart: "Leo Wang",
      summary: "候选人希望本周三前确认终面评审组 和时间。",
      participants: [accountEmail.toLowerCase(), "leo@candidate.demo"],
      status: ThreadStatus.WAITING_US,
      waitingOn: "我方",
      shouldReply: true,
      updatedAt: subDays(now, 2),
      messages: [
        {
          externalMessageId: "mock-aliyun-message-2",
          sender: "Leo Wang",
          senderEmail: "leo@candidate.demo",
          body: "如果评审组已确定，我可以配合本周四或周五安排终面。",
          snippet: "我可以配合本周四或周五安排终面。",
          isInbound: true,
          sentAt: subDays(now, 2),
          participants: [accountEmail.toLowerCase(), "leo@candidate.demo"],
        },
      ],
    },
    {
      externalThreadId: "mock-aliyun-thread-3",
      subject: "Atlas 联合内容合作范围",
      counterpart: "Mia Xu",
      summary: "对方希望先确认联名内容形式，再决定渠道分发节奏。",
      participants: [accountEmail.toLowerCase(), "mia@atlas-ai.demo"],
      status: ThreadStatus.WAITING_THEM,
      waitingOn: "对方",
      shouldReply: false,
      updatedAt: subDays(now, 3),
      messages: [
        {
          externalMessageId: "mock-aliyun-message-3",
          sender: "林舟",
          senderEmail: accountEmail.toLowerCase(),
          body: "我们建议先定义一版联名内容大纲，再对齐渠道和分账方式。",
          snippet: "建议先定义一版联名内容大纲。",
          isInbound: false,
          sentAt: subDays(now, 3),
          participants: [accountEmail.toLowerCase(), "mia@atlas-ai.demo"],
        },
      ],
    },
  ];
}

export async function syncMockGmailConnector(input: {
  workspaceId: string;
  userId: string;
  connectorId?: string | null;
  accountEmail?: string | null;
}) {
  const connector = input.connectorId
    ? await db.connector.findUnique({
        where: { id: input.connectorId },
      })
    : await db.connector.upsert({
        where: {
          workspaceId_userId_provider: {
            workspaceId: input.workspaceId,
            userId: input.userId,
            provider: ConnectorProvider.GMAIL,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          provider: ConnectorProvider.GMAIL,
          status: ConnectorStatus.CONNECTED,
          externalAccountEmail: input.accountEmail ?? "demo.aliyun@helm.local",
          lastSyncStatus: "已接入本地 mock 阿里邮箱",
          metadata: JSON.stringify({ mode: "mock", transport: "imap" }),
        },
        update: {
          status: ConnectorStatus.CONNECTED,
          externalAccountEmail: input.accountEmail ?? "demo.aliyun@helm.local",
          lastSyncStatus: "已接入本地 mock 阿里邮箱",
          metadata: JSON.stringify({ mode: "mock", transport: "imap" }),
        },
      });

  if (!connector) {
    throw new Error("mock 阿里邮箱连接器不存在");
  }

  const accountEmail = connector.externalAccountEmail ?? input.accountEmail ?? "demo.aliyun@helm.local";

  for (const thread of buildMockThreads(accountEmail)) {
    await upsertNormalizedThread({
      workspaceId: connector.workspaceId,
      accountEmail,
      thread,
    });
  }

  const updated = await db.connector.update({
    where: { id: connector.id },
    data: {
      status: ConnectorStatus.CONNECTED,
      lastSyncedAt: new Date(),
      lastSyncStatus: "本地 mock 同步完成",
      lastSyncMessage: "已同步 3 条示例阿里邮箱线程，用于本地演示和试点前联调。",
    },
  });

  await logEvent({
    workspaceId: updated.workspaceId,
    userId: updated.userId,
    eventName: "connector_sync_triggered",
    eventCategory: "connector",
    targetType: "Connector",
    targetId: updated.id,
    metadata: {
      provider: updated.provider,
      syncedThreads: 3,
      usedMock: true,
      mailProvider: "ALIYUN",
    },
    sourcePage: "/settings",
  });

  return {
    connector: updated,
    syncedThreads: 3,
    syncedMessages: 3,
    usedMock: true,
  };
}

export async function sendAliyunMailFromConnector(input: {
  connectorId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  explicitUserTrigger: boolean;
}) {
  ensureManualSendAllowed({ explicitUserTrigger: input.explicitUserTrigger });

  const connector = await db.connector.findUnique({
    where: { id: input.connectorId },
  });

  if (!connector) {
    throw new Error("连接器不存在");
  }

  if (!connector.manualSendEnabled) {
    throw new Error("当前连接器未开启手动发送权限。");
  }

  const smtpHost = connector.smtpHost || getAliyunMailServerConfig().smtpHost;
  const smtpPort = connector.smtpPort || getAliyunMailServerConfig().smtpPort;
  const smtpSecure = connector.smtpSecure ?? getAliyunMailServerConfig().smtpSecure;
  const username = connector.smtpUsername || connector.externalAccountEmail;
  const password = readConnectorToken(connector.smtpPassword);

  if (!username || !password) {
    throw new Error("SMTP 凭据缺失，请重新连接阿里邮箱。 ");
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: username,
      pass: password,
    },
  });

  const info = await transport.sendMail({
    from: connector.externalAccountEmail || username,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  await db.connector.update({
    where: { id: connector.id },
    data: {
      metadata: JSON.stringify({
        ...parseAliyunConnectorMetadata(connector.metadata),
        lastSendResult: {
          status: "SUCCESS",
          at: new Date().toISOString(),
          message: info.messageId,
        },
      }),
    },
  });

  return {
    messageId: info.messageId,
  };
}
