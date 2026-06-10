import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildAttachmentDownloadUrl,
  buildAttachmentStorageKey,
  getAttachmentExtensionForMimeType,
  getAttachmentUploadRoot,
  isAllowedAttachmentMimeType,
  resolveAttachmentStoragePath,
} from "@/lib/opportunities/attachment-storage";

const originalUploadDir = process.env.HELM_UPLOAD_DIR;

afterEach(() => {
  if (originalUploadDir === undefined) {
    delete process.env.HELM_UPLOAD_DIR;
  } else {
    process.env.HELM_UPLOAD_DIR = originalUploadDir;
  }
});

describe("attachment MIME allowlist", () => {
  it("accepts inert document/image types", () => {
    expect(isAllowedAttachmentMimeType("application/pdf")).toBe(true);
    expect(isAllowedAttachmentMimeType("image/png")).toBe(true);
    expect(getAttachmentExtensionForMimeType("image/png")).toBe(".png");
  });

  it("rejects executable/markup types that could run script", () => {
    expect(isAllowedAttachmentMimeType("text/html")).toBe(false);
    expect(isAllowedAttachmentMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedAttachmentMimeType("application/javascript")).toBe(false);
    expect(isAllowedAttachmentMimeType("")).toBe(false);
    expect(getAttachmentExtensionForMimeType("text/html")).toBe("");
  });
});

describe("storage path resolution", () => {
  it("stores outside the public tree", () => {
    const root = getAttachmentUploadRoot();
    expect(root).not.toContain(`${path.sep}public${path.sep}`);
  });

  it("resolves a normal key under the upload root", () => {
    process.env.HELM_UPLOAD_DIR = "/tmp/helm-uploads-test";
    const key = buildAttachmentStorageKey({
      workspaceId: "ws1",
      opportunityId: "opp1",
      storedFileName: "123-abc.pdf",
    });
    expect(key).toBe("ws1/opp1/123-abc.pdf");
    const resolved = resolveAttachmentStoragePath(key);
    expect(resolved).toBe("/tmp/helm-uploads-test/ws1/opp1/123-abc.pdf");
  });

  it("rejects traversal and absolute keys", () => {
    process.env.HELM_UPLOAD_DIR = "/tmp/helm-uploads-test";
    expect(resolveAttachmentStoragePath("../../etc/passwd")).toBeNull();
    expect(resolveAttachmentStoragePath("ws1/../../secret")).toBeNull();
    expect(resolveAttachmentStoragePath("/etc/passwd")).toBeNull();
    expect(resolveAttachmentStoragePath("ws1/\0/x")).toBeNull();
    expect(resolveAttachmentStoragePath("")).toBeNull();
  });
});

describe("download url", () => {
  it("points at the authenticated route, not a static path", () => {
    const url = buildAttachmentDownloadUrl({ opportunityId: "opp1", memoryEntryId: "mem1" });
    expect(url).toBe("/api/opportunities/opp1/attachments/mem1");
  });
});
