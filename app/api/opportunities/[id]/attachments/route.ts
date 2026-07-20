import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ActorType, MemoryEntityType, MemoryType, ObjectType } from "@prisma/client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { assertWorkspaceObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import {
  canManageWorkspaceRecords,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
} from "@/lib/auth/workspace-data-governance";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE,
  buildOpportunityAttachmentMemoryPayload,
  parseOpportunityAttachmentMemoryEntry,
} from "@/lib/opportunities/attachment-memory";
import {
  buildAttachmentDownloadUrl,
  buildAttachmentStorageKey,
  getAttachmentExtensionForMimeType,
  getAttachmentUploadRoot,
  isAllowedAttachmentMimeType,
} from "@/lib/opportunities/attachment-storage";
import { errorResponse, successResponse } from "@/lib/memory/shared";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const runtime = "nodejs";

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim();
  const fallback = `attachment-${Date.now()}`;
  if (!trimmed) return fallback;
  return trimmed
    .replace(/[^\w.\-()\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || fallback;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return errorResponse(getWorkspaceRecordManagementDeniedMessage(english), "OPPORTUNITY_GOVERNANCE_REQUIRED", 403);
  }

  const { id: opportunityId } = await context.params;

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

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return errorResponse(
      english ? "Please upload a file." : "请上传文件。",
      "INVALID_ATTACHMENT_REQUEST",
      400,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(
      english ? "Please choose a valid file." : "请选择有效文件。",
      "INVALID_ATTACHMENT_FILE",
      400,
    );
  }

  if (file.size <= 0) {
    return errorResponse(
      english ? "The selected file is empty." : "所选文件为空。",
      "EMPTY_ATTACHMENT_FILE",
      400,
    );
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return errorResponse(
      english ? "File too large. Max 10MB per file." : "文件过大，单个文件最多 10MB。",
      "ATTACHMENT_FILE_TOO_LARGE",
      400,
    );
  }

  // Only inert document/image types may be stored — rejecting html/svg/js etc.
  // closes the stored-XSS vector at the source rather than relying on download
  // headers alone.
  if (!isAllowedAttachmentMimeType(file.type)) {
    return errorResponse(
      english
        ? "Unsupported file type. Allowed: PDF, Office documents, plain text/markdown, and PNG/JPEG/WebP/GIF images."
        : "不支持的文件类型。允许：PDF、Office 文档、纯文本/Markdown，以及 PNG/JPEG/WebP/GIF 图片。",
      "ATTACHMENT_MIME_NOT_ALLOWED",
      415,
    );
  }

  const sanitizedName = sanitizeFileName(file.name);
  // Stored filename's extension is derived ONLY from the allowlisted MIME type,
  // never from the user-supplied name.
  const extension = getAttachmentExtensionForMimeType(file.type);
  const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;
  const storageKey = buildAttachmentStorageKey({
    workspaceId: workspace.id,
    opportunityId,
    storedFileName,
  });
  const absoluteDir = path.join(
    getAttachmentUploadRoot(),
    workspace.id,
    opportunityId,
  );
  const absolutePath = path.join(
    /* turbopackIgnore: true */ absoluteDir,
    storedFileName,
  );

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  const uploadedAt = new Date();
  // url points at the authenticated download route, never a static asset path.
  const payload = buildOpportunityAttachmentMemoryPayload({
    fileName: sanitizedName,
    mimeType: file.type,
    sizeBytes: file.size,
    url: "",
    storageKey,
    uploadedAt,
  });

  const created = await db.memoryEntry.create({
    data: {
      workspaceId: workspace.id,
      opportunityId,
      entityType: MemoryEntityType.OPPORTUNITY,
      memoryType: MemoryType.NOTE,
      title: english ? `Attachment · ${sanitizedName}` : `附件 · ${sanitizedName}`,
      content: JSON.stringify(payload),
      source: OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE,
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
    },
  });

  // The download URL needs the persisted memory-entry id, so backfill it now.
  const downloadUrl = buildAttachmentDownloadUrl({
    opportunityId,
    memoryEntryId: created.id,
  });
  const finalContent = JSON.stringify(
    buildOpportunityAttachmentMemoryPayload({
      fileName: sanitizedName,
      mimeType: file.type,
      sizeBytes: file.size,
      url: downloadUrl,
      storageKey,
      uploadedAt,
    }),
  );
  await db.memoryEntry.update({
    where: { id: created.id },
    data: { content: finalContent },
  });
  created.content = finalContent;

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "OPPORTUNITY_UPDATED",
    targetType: "Opportunity",
    targetId: opportunityId,
    summary: english
      ? `Uploaded attachment: ${sanitizedName}`
      : `上传附件：${sanitizedName}`,
    payload: {
      memoryEntryId: created.id,
      attachmentUrl: downloadUrl,
      storageKey,
      sizeBytes: file.size,
      mimeType: file.type,
    },
    relatedObjectType: "Opportunity",
    relatedObjectId: opportunityId,
    sourcePage: "/opportunities",
  });

  const attachment = parseOpportunityAttachmentMemoryEntry(created);

  if (!attachment) {
    return errorResponse(
      english ? "Attachment uploaded but metadata parse failed." : "附件已上传，但元数据解析失败。",
      "ATTACHMENT_METADATA_INVALID",
      500,
    );
  }

  return successResponse(attachment, english ? "attachment uploaded" : "附件上传成功");
}
