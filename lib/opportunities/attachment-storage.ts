import path from "node:path";

/**
 * Opportunity attachment storage + safety policy.
 *
 * Attachments used to be written into `public/` and served statically with no
 * auth — so any uploaded file (incl. HTML/SVG) became a same-origin asset
 * reachable by URL guessing across tenants, i.e. stored XSS + cross-tenant
 * exposure. Files are now stored OUTSIDE the public tree and streamed through
 * an authenticated route, and only an allowlisted set of inert document/image
 * MIME types may be stored at all.
 */

// MIME → canonical extension. Intentionally excludes executable/markup types
// (html, svg, xml, js, ...) that could run script when served inline.
const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_EXTENSIONS, mimeType);
}

export function getAttachmentExtensionForMimeType(mimeType: string): string {
  return ALLOWED_MIME_EXTENSIONS[mimeType] ?? "";
}

export function listAllowedAttachmentMimeTypes(): string[] {
  return Object.keys(ALLOWED_MIME_EXTENSIONS);
}

/**
 * Private upload root, OUTSIDE `public/`. Override with HELM_UPLOAD_DIR for
 * deployments that mount a dedicated volume.
 */
export function getAttachmentUploadRoot(): string {
  const configured = process.env.HELM_UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), "var", "uploads", "opportunity-attachments");
}

/** Storage key (path relative to the upload root) for a stored attachment. */
export function buildAttachmentStorageKey(input: {
  workspaceId: string;
  opportunityId: string;
  storedFileName: string;
}): string {
  return path.posix.join(
    input.workspaceId,
    input.opportunityId,
    input.storedFileName,
  );
}

/**
 * Resolves a storage key to an absolute path, rejecting traversal attempts
 * (`..`, absolute keys) that would escape the upload root.
 */
export function resolveAttachmentStoragePath(storageKey: string): string | null {
  if (!storageKey || path.isAbsolute(storageKey) || storageKey.includes("\0")) {
    return null;
  }
  const root = getAttachmentUploadRoot();
  const resolved = path.resolve(root, storageKey);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    return null;
  }
  return resolved;
}

/** Authenticated download URL the client links to (never a static path). */
export function buildAttachmentDownloadUrl(input: {
  opportunityId: string;
  memoryEntryId: string;
}): string {
  return `/api/opportunities/${encodeURIComponent(input.opportunityId)}/attachments/${encodeURIComponent(input.memoryEntryId)}`;
}
