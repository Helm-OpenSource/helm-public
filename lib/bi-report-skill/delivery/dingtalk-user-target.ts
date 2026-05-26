import { ConnectorProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { parseDingTalkConnectorMetadata } from "@/lib/connectors/dingtalk";
import { resolveDingTalkDirectoryInviteUserId } from "@/lib/connectors/dingtalk-directory-invite-snapshot";

export async function resolveDingTalkUnionIdForWorkspaceUser(input: {
  workspaceId: string;
  userId: string;
}): Promise<string | null> {
  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.DINGTALK,
      },
    },
    select: {
      metadata: true,
      status: true,
    },
  });
  if (!connector) return null;

  const metadata = parseDingTalkConnectorMetadata(connector.metadata);
  return metadata.lastResolvedUnionId ?? null;
}

export function buildDingTalkAppMessageTargetKey(input: { unionId: string }) {
  const unionId = input.unionId.trim();
  if (!unionId) {
    throw new Error("DingTalk unionId is empty");
  }
  return `unionId:${unionId}`;
}

export function buildDingTalkAppMessageTargetKeyFromUserId(input: { userId: string }) {
  const userId = input.userId.trim();
  if (!userId) {
    throw new Error("DingTalk userId is empty");
  }
  return `userId:${userId}`;
}

export async function resolveDingTalkAppMessageTargetKeyForWorkspaceUser(input: {
  workspaceId: string;
  userId: string;
}): Promise<string | null> {
  const unionId = await resolveDingTalkUnionIdForWorkspaceUser(input);
  if (unionId) {
    return buildDingTalkAppMessageTargetKey({ unionId });
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) return null;

  const dingtalkUserId = await resolveDingTalkDirectoryInviteUserId({
    workspaceId: input.workspaceId,
    name: user.name,
    email: user.email,
    phone: user.phone,
  });
  if (!dingtalkUserId) return null;

  return buildDingTalkAppMessageTargetKeyFromUserId({ userId: dingtalkUserId });
}
