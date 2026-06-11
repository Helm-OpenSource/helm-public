import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { MemoryEntityType, ObjectType } from "@prisma/client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { getWorkspaceScopedRecordUnavailableMessage } from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";
import {
  OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE,
  parseOpportunityAttachmentMemoryEntry,
} from "@/lib/opportunities/attachment-memory";
import {
  isAllowedAttachmentMimeType,
  resolveAttachmentStoragePath,
} from "@/lib/opportunities/attachment-storage";
import { errorResponse } from "@/lib/memory/shared";

export const runtime = "nodejs";

/**
 * Authenticated attachment download. Replaces the old static-file exposure:
 * verifies the session + workspace + opportunity ownership, then streams the
 * file from the private upload root with anti-sniffing / forced-download
 * headers so a stored document can never execute in the app origin.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  // getCurrentWorkspaceSession guarantees an authenticated, active member of
  // this workspace; opportunity ownership is verified below. Any such member
  // may download attachments of an opportunity they can see (read operation).
  const { workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  const { id: opportunityId, attachmentId } = await context.params;

  try {
    await assertWorkspaceObjectOwnership({
      workspaceId: workspace.id,
      objectType: ObjectType.OPPORTUNITY,
      objectId: opportunityId,
    });
  } catch (error) {
    return errorResponse(
      getWorkspaceScopedRecordUnavailableMessage(english, "opportunity"),
      isWorkspaceOwnershipError(error) ? "OPPORTUNITY_NOT_FOUND" : "OPPORTUNITY_OWNERSHIP_FAILED",
      isWorkspaceOwnershipError(error) ? 404 : 500,
    );
  }

  // Scope the memory entry to workspace + opportunity so an attachment id from
  // another tenant/opportunity cannot be read.
  const entry = await db.memoryEntry.findFirst({
    where: {
      id: attachmentId,
      workspaceId: workspace.id,
      opportunityId,
      entityType: MemoryEntityType.OPPORTUNITY,
      source: OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE,
    },
    select: { id: true, title: true, content: true, createdAt: true },
  });

  const attachment = entry ? parseOpportunityAttachmentMemoryEntry(entry) : null;
  if (!attachment || !attachment.storageKey) {
    return errorResponse(
      english ? "Attachment not found." : "未找到附件。",
      "ATTACHMENT_NOT_FOUND",
      404,
    );
  }

  const absolutePath = resolveAttachmentStoragePath(attachment.storageKey);
  if (!absolutePath) {
    return errorResponse(
      english ? "Attachment not found." : "未找到附件。",
      "ATTACHMENT_NOT_FOUND",
      404,
    );
  }

  let data: Buffer;
  try {
    data = await readFile(absolutePath);
  } catch {
    return errorResponse(
      english ? "Attachment file is no longer available." : "附件文件已不可用。",
      "ATTACHMENT_FILE_MISSING",
      404,
    );
  }

  // Never trust the stored MIME for inline rendering; force a download and
  // disable content sniffing.
  const contentType = isAllowedAttachmentMimeType(attachment.mimeType)
    ? attachment.mimeType
    : "application/octet-stream";
  const asciiName = attachment.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(attachment.fileName);

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
