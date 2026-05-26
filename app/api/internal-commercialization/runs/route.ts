import { NextResponse } from "next/server";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canReadContributionRegistry,
  getContributionRegistryManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
import { getInternalCommercializationLifecycleReadout } from "@/lib/internal-commercialization/runtime";
import { assertHelmReservedWorkspaceAccess } from "@/lib/workspace-reserved";

export async function GET() {
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

  if (!canReadContributionRegistry(membership.role)) {
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

  const readout = await getInternalCommercializationLifecycleReadout(
    workspace.id,
    english,
  );

  return NextResponse.json(
    { ok: true, readout },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
