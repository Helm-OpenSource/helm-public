import { ImportSourceStatus, type ImportSourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { readConnectorToken, storeConnectorToken } from "@/lib/connectors/token-store";

export async function upsertImportSource(input: {
  workspaceId: string;
  userId?: string | null;
  sourceType: ImportSourceType;
  sourceName: string;
  status?: ImportSourceStatus;
  authMode?: string | null;
  externalAccountId?: string | null;
  externalAccountLabel?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  configJson?: string | null;
}) {
  const existing = input.externalAccountId
    ? await db.importSource.findFirst({
        where: {
          workspaceId: input.workspaceId,
          sourceType: input.sourceType,
          externalAccountId: input.externalAccountId,
        },
      })
    : await db.importSource.findFirst({
        where: {
          workspaceId: input.workspaceId,
          sourceType: input.sourceType,
          userId: input.userId ?? undefined,
        },
      });

  if (!existing) {
    return db.importSource.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        status: input.status ?? ImportSourceStatus.CONNECTED,
        authMode: input.authMode ?? null,
        externalAccountId: input.externalAccountId ?? null,
        externalAccountLabel: input.externalAccountLabel ?? null,
        accessToken: storeConnectorToken(input.accessToken),
        refreshToken: storeConnectorToken(input.refreshToken),
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        configJson: input.configJson ?? null,
      },
    });
  }

  return db.importSource.update({
    where: { id: existing.id },
    data: {
      userId: input.userId ?? existing.userId,
      sourceName: input.sourceName,
      status: input.status ?? existing.status,
      authMode: input.authMode ?? existing.authMode,
      externalAccountId: input.externalAccountId ?? existing.externalAccountId,
      externalAccountLabel: input.externalAccountLabel ?? existing.externalAccountLabel,
      accessToken: input.accessToken ? storeConnectorToken(input.accessToken) : undefined,
      refreshToken: input.refreshToken ? storeConnectorToken(input.refreshToken) : undefined,
      tokenExpiresAt: input.tokenExpiresAt ?? existing.tokenExpiresAt,
      configJson: input.configJson ?? existing.configJson,
    },
  });
}

export async function getImportSourceWithAccessToken(sourceId: string) {
  const source = await db.importSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error("导入来源不存在");
  }

  return {
    source,
    accessToken: readConnectorToken(source.accessToken),
    refreshToken: readConnectorToken(source.refreshToken),
  };
}
