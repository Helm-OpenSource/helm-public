import { timingSafeEqual } from "node:crypto";
import { ActorType, ConnectorProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { syncDingTalkReadonlyConnector } from "@/lib/connectors/dingtalk-ingestion";
import { db } from "@/lib/db";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { serverErrorMessage } from "@/lib/http/server-error";

function isAuthorized(request: Request) {
  const expected = process.env.DINGTALK_SYNC_CRON_TOKEN?.trim() || "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "DINGTALK_SYNC_CRON_TOKEN is not configured.",
    } as const;
  }

  const token = request.headers.get("x-helm-cron-token")?.trim() || "";
  if (!safeTokenEqual(token, expected)) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized cron token.",
    } as const;
  }

  return {
    ok: true,
  } as const;
}

function safeTokenEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const connectors = await db.connector.findMany({
    where: {
      provider: ConnectorProvider.DINGTALK,
      status: {
        in: ["CONNECTED", "ERROR"],
      },
    },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      status: true,
      workspace: {
        select: {
          defaultLocale: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  let successCount = 0;
  let partialCount = 0;
  let failedCount = 0;
  let unresolvedCount = 0;
  const details: Array<{ connectorId: string; status: string; message: string | null }> = [];

  for (const connector of connectors) {
    try {
      const english = isEnglishWorkspaceDefaultLocale(connector.workspace.defaultLocale);
      const result = await syncDingTalkReadonlyConnector({
        workspaceId: connector.workspaceId,
        userId: connector.userId,
        english,
        sourcePage: "/api/runtime/dingtalk/hourly-sync",
        triggeredBy: "system-cron",
      });

      if (result.status === "SUCCESS") {
        successCount += 1;
      } else if (result.status === "PARTIAL") {
        partialCount += 1;
      } else if (result.status === "UNRESOLVED") {
        unresolvedCount += 1;
      } else {
        failedCount += 1;
      }

      details.push({
        connectorId: connector.id,
        status: result.status,
        message: result.ingestResult.message,
      });

      await logEvent({
        workspaceId: connector.workspaceId,
        userId: connector.userId,
        eventName: "connector_sync_triggered",
        eventCategory: "connector",
        targetType: "Connector",
        targetId: connector.id,
        metadata: {
          provider: "DINGTALK",
          mode: "cron_hourly",
          ingestStatus: result.status,
          persistedPayloadCount: result.ingestResult.persistedPayloadCount,
        },
        sourcePage: "/api/runtime/dingtalk/hourly-sync",
      });

      await writeAuditLog({
        workspaceId: connector.workspaceId,
        userId: connector.userId,
        actor: "system-cron",
        actorType: ActorType.SYSTEM,
        actionType: "DINGTALK_READONLY_INGEST_CRON",
        targetType: "Connector",
        targetId: connector.id,
        summary: `Hourly DingTalk MCP sync finished with ${result.status}`,
        payload: {
          provider: "DINGTALK",
          mode: "cron_hourly",
          ingestStatus: result.status,
          persistedPayloadCount: result.ingestResult.persistedPayloadCount,
          scopeResults: result.ingestResult.scopeResults,
        },
        sourcePage: "/api/runtime/dingtalk/hourly-sync",
      });
    } catch (error) {
      failedCount += 1;
      details.push({
        connectorId: connector.id,
        status: "FAILURE",
        message: serverErrorMessage(error, "unknown error"),
      });

      await writeAuditLog({
        workspaceId: connector.workspaceId,
        userId: connector.userId,
        actor: "system-cron",
        actorType: ActorType.SYSTEM,
        actionType: "DINGTALK_READONLY_INGEST_CRON_FAILED",
        targetType: "Connector",
        targetId: connector.id,
        summary: "Hourly DingTalk MCP sync failed",
        payload: {
          provider: "DINGTALK",
          mode: "cron_hourly",
          error: error instanceof Error ? error.message : String(error),
        },
        sourcePage: "/api/runtime/dingtalk/hourly-sync",
      });
    }
  }

  revalidatePath("/settings");

  return NextResponse.json({
    ok: true,
    total: connectors.length,
    successCount,
    partialCount,
    unresolvedCount,
    failedCount,
    details,
  });
}
