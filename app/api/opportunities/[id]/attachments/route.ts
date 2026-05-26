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

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "text/plain") return ".txt";
  if (mimeType === "text/markdown") return ".md";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (mimeType === "application/msword") return ".doc";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return ".xlsx";
  if (mimeType === "application/vnd.ms-excel") return ".xls";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return ".pptx";
  if (mimeType === "application/vnd.ms-powerpoint") return ".ppt";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return "";
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

  const sanitizedName = sanitizeFileName(file.name);
  const originalExt = path.extname(sanitizedName);
  const extension = originalExt || getExtensionFromMimeType(file.type);
  const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;
  const relativeDir = path.join(
    "uploads",
    "opportunity-attachments",
    workspace.id,
    opportunityId,
  );
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  const absolutePath = path.join(absoluteDir, storedFileName);
  const relativePath = `/${path
    .join(relativeDir, storedFileName)
    .replaceAll(path.sep, "/")}`;

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  const uploadedAt = new Date();
  const payload = buildOpportunityAttachmentMemoryPayload({
    fileName: sanitizedName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    url: relativePath,
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
      attachmentUrl: relativePath,
      sizeBytes: file.size,
      mimeType: file.type || "application/octet-stream",
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
