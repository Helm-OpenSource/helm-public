import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageContributionRegistry,
  getContributionRegistryManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { runInternalCommercializationFixtureConnector } from "@/lib/internal-commercialization/fixture-connector";
import { assertHelmReservedWorkspaceAccess } from "@/lib/workspace-reserved";

const requestSchema = z.object({
  dryRun: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  try {
    assertHelmReservedWorkspaceAccess(
      workspace,
      english,
      "commercial_registry",
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reserved workspace required",
      },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  if (!canManageContributionRegistry(membership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: getContributionRegistryManagementDeniedMessage(english),
      },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: english
          ? "Invalid internal commercialization connector request"
          : "自身商业化 connector 请求无效",
      },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  if (!parsed.data.dryRun) {
    return NextResponse.json(
      {
        ok: false,
        error: english
          ? "Web connector endpoint is dry-run only. Use the gated CLI apply path for internal seed writes."
          : "Web connector 端点只做 dry-run。内部 seed 写入请使用带门禁的 CLI apply 路径。",
      },
      {
        status: 409,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  const result = await runInternalCommercializationFixtureConnector({
    workspaceId: workspace.id,
    dryRun: true,
  }).catch((error) =>
    NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : english
              ? "Internal commercialization connector contract failed"
              : "自身商业化 connector 契约校验失败",
      },
      {
        status: 422,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    ),
  );

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json(
    {
      ok: true,
      connectorId: result.connectorId,
      dryRun: result.dryRun,
      importedCount: result.importedCount,
      candidateCount: result.candidateCount,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
