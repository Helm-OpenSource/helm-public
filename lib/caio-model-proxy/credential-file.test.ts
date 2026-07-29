import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, symlink, link, writeFile, chmod, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CAIO_CREDENTIAL_MAX_BYTES,
  CaioCredentialError,
  SAME_UID_ISOLATION_DISCLAIMER,
  completeRotation,
  loadCredential,
  rotateCredentialFile,
} from "./credential-file";

let sandbox: string;

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "caio-cred-"));
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

async function seedCredential(
  ref: string,
  content: string,
  mode = 0o600,
): Promise<string> {
  const filePath = path.join(sandbox, ref);
  await writeFile(filePath, content, { mode });
  // writeFile mode is masked by umask; force the exact bits.
  await chmod(filePath, mode);
  return filePath;
}

async function expectCredentialError(
  promise: Promise<unknown>,
  code: string,
): Promise<CaioCredentialError> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(CaioCredentialError);
  const err = caught as CaioCredentialError;
  expect(err.code).toBe(code);
  return err;
}

describe("loadCredential", () => {
  it("loads a valid 0600 credential file and trims content", async () => {
    await seedCredential("upstream-key", "  sk-test-secret-value \n");
    const content = await loadCredential({
      allowedDir: sandbox,
      credentialRef: "upstream-key",
    });
    expect(content).toBe("sk-test-secret-value");
  });

  it("rejects refs with dots, slashes, uppercase, or bad length", async () => {
    for (const ref of [
      "../etc-passwd",
      "a/b",
      "a.b",
      "UPPER",
      "a",
      "-leading",
      `x${"y".repeat(70)}`,
    ]) {
      await expectCredentialError(
        loadCredential({ allowedDir: sandbox, credentialRef: ref }),
        "credential_ref_invalid",
      );
    }
  });

  it("rejects a relative allowedDir", async () => {
    await expectCredentialError(
      loadCredential({
        allowedDir: "relative/dir",
        credentialRef: "upstream-key",
      }),
      "credential_ref_invalid",
    );
  });

  it("reports credential_not_found for a missing file", async () => {
    await expectCredentialError(
      loadCredential({ allowedDir: sandbox, credentialRef: "missing-key" }),
      "credential_not_found",
    );
  });

  it("rejects a file with group/other permission bits", async () => {
    await seedCredential("world-readable", "secret", 0o644);
    await expectCredentialError(
      loadCredential({
        allowedDir: sandbox,
        credentialRef: "world-readable",
      }),
      "credential_unsafe_mode",
    );
  });

  it("rejects a 0400 file (mode must be exactly 0600)", async () => {
    await seedCredential("read-only", "secret", 0o400);
    await expectCredentialError(
      loadCredential({ allowedDir: sandbox, credentialRef: "read-only" }),
      "credential_unsafe_mode",
    );
  });

  it("rejects a symlink even when the target is a valid credential", async () => {
    await seedCredential("real-key", "secret");
    await symlink(
      path.join(sandbox, "real-key"),
      path.join(sandbox, "sneaky-link"),
    );
    await expectCredentialError(
      loadCredential({ allowedDir: sandbox, credentialRef: "sneaky-link" }),
      "credential_symlink_rejected",
    );
  });

  it("rejects a hardlinked credential file (nlink > 1)", async () => {
    const target = await seedCredential("linked-key", "secret");
    await link(target, path.join(sandbox, "linked-copy"));
    await expectCredentialError(
      loadCredential({ allowedDir: sandbox, credentialRef: "linked-key" }),
      "credential_hardlink_rejected",
    );
  });

  it("rejects a file above the 8 KiB size cap", async () => {
    await seedCredential(
      "oversize-key",
      "x".repeat(CAIO_CREDENTIAL_MAX_BYTES + 1),
    );
    await expectCredentialError(
      loadCredential({ allowedDir: sandbox, credentialRef: "oversize-key" }),
      "credential_unsafe_mode",
    );
  });

  it("rejects an empty credential file", async () => {
    await seedCredential("empty-key", "   \n");
    await expectCredentialError(
      loadCredential({ allowedDir: sandbox, credentialRef: "empty-key" }),
      "credential_unsafe_mode",
    );
  });

  it("never includes file content or resolved path in error messages", async () => {
    await seedCredential("world-readable-2", "super-secret-token", 0o644);
    const err = await expectCredentialError(
      loadCredential({
        allowedDir: sandbox,
        credentialRef: "world-readable-2",
      }),
      "credential_unsafe_mode",
    );
    expect(err.message).not.toContain("super-secret-token");
    expect(err.message).not.toContain(sandbox);
  });
});

describe("rotateCredentialFile", () => {
  it("atomically replaces the credential and retains a 0600 rollback inside the window", async () => {
    await seedCredential("rotating-key", "old-secret");
    const result = await rotateCredentialFile({
      allowedDir: sandbox,
      credentialRef: "rotating-key",
      newContent: "new-secret\n",
      retainRollback: true,
    });
    expect(result).toEqual({ rotated: true, rollbackRetained: true });

    const loaded = await loadCredential({
      allowedDir: sandbox,
      credentialRef: "rotating-key",
    });
    expect(loaded).toBe("new-secret");

    const rollbackPath = path.join(sandbox, "rotating-key.rollback");
    expect((await readFile(rollbackPath, "utf8")).trim()).toBe("old-secret");
    expect((await stat(rollbackPath)).mode & 0o777).toBe(0o600);

    // No stray temp files remain.
    const leftovers = (await readdir(sandbox)).filter((f) =>
      f.includes(".next."),
    );
    expect(leftovers).toEqual([]);
  });

  it("does not create a rollback file when retainRollback is false", async () => {
    await seedCredential("rotating-key", "old-secret");
    const result = await rotateCredentialFile({
      allowedDir: sandbox,
      credentialRef: "rotating-key",
      newContent: "new-secret",
      retainRollback: false,
    });
    expect(result.rollbackRetained).toBe(false);
    await expect(
      stat(path.join(sandbox, "rotating-key.rollback")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates a fresh credential when no previous file exists", async () => {
    const result = await rotateCredentialFile({
      allowedDir: sandbox,
      credentialRef: "brand-new-key",
      newContent: "first-secret",
      retainRollback: true,
    });
    // Nothing to roll back to on first provisioning.
    expect(result.rollbackRetained).toBe(false);
    const loaded = await loadCredential({
      allowedDir: sandbox,
      credentialRef: "brand-new-key",
    });
    expect(loaded).toBe("first-secret");
    expect(
      (await stat(path.join(sandbox, "brand-new-key"))).mode & 0o777,
    ).toBe(0o600);
  });

  it("rejects invalid refs and empty/oversize new content", async () => {
    await expectCredentialError(
      rotateCredentialFile({
        allowedDir: sandbox,
        credentialRef: "../evil",
        newContent: "x",
        retainRollback: false,
      }),
      "credential_ref_invalid",
    );
    await expectCredentialError(
      rotateCredentialFile({
        allowedDir: sandbox,
        credentialRef: "some-key",
        newContent: "   ",
        retainRollback: false,
      }),
      "credential_unsafe_mode",
    );
    await expectCredentialError(
      rotateCredentialFile({
        allowedDir: sandbox,
        credentialRef: "some-key",
        newContent: "x".repeat(CAIO_CREDENTIAL_MAX_BYTES + 1),
        retainRollback: false,
      }),
      "credential_unsafe_mode",
    );
  });

  it("preserves the previous credential when the target was replaced by an unsafe file", async () => {
    // Target exists but is world-readable: safe read of previous content
    // fails, rotation must abort and leave no temp files behind.
    await seedCredential("tampered-key", "old-secret", 0o644);
    await expectCredentialError(
      rotateCredentialFile({
        allowedDir: sandbox,
        credentialRef: "tampered-key",
        newContent: "new-secret",
        retainRollback: true,
      }),
      "credential_unsafe_mode",
    );
    const leftovers = (await readdir(sandbox)).filter((f) =>
      f.includes(".next."),
    );
    expect(leftovers).toEqual([]);
    expect(await readFile(path.join(sandbox, "tampered-key"), "utf8")).toBe(
      "old-secret",
    );
  });
  it("can repair a tampered target when no rollback window is requested", async () => {
    await seedCredential("tampered-key", "old-secret", 0o644);
    const result = await rotateCredentialFile({
      allowedDir: sandbox,
      credentialRef: "tampered-key",
      newContent: "new-secret",
      retainRollback: false,
    });
    expect(result.rollbackRetained).toBe(false);
    const loaded = await loadCredential({
      allowedDir: sandbox,
      credentialRef: "tampered-key",
    });
    expect(loaded).toBe("new-secret");
  });
});

describe("completeRotation", () => {
  it("deletes the rollback file and closes the window", async () => {
    await seedCredential("finishing-key", "old-secret");
    await rotateCredentialFile({
      allowedDir: sandbox,
      credentialRef: "finishing-key",
      newContent: "new-secret",
      retainRollback: true,
    });
    const completion = await completeRotation({
      allowedDir: sandbox,
      credentialRef: "finishing-key",
    });
    expect(completion.rollbackDeleted).toBe(true);
    await expect(
      stat(path.join(sandbox, "finishing-key.rollback")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("is a no-op when no rollback window is open", async () => {
    const completion = await completeRotation({
      allowedDir: sandbox,
      credentialRef: "finishing-key",
    });
    expect(completion.rollbackDeleted).toBe(false);
  });

  it("rejects invalid refs", async () => {
    await expectCredentialError(
      completeRotation({ allowedDir: sandbox, credentialRef: "a.b" }),
      "credential_ref_invalid",
    );
  });
});

describe("SAME_UID_ISOLATION_DISCLAIMER", () => {
  it("states the honest same-uid boundary explicitly", () => {
    expect(SAME_UID_ISOLATION_DISCLAIMER).toContain(
      "rotation, audit, and fault-domain separation only",
    );
    expect(SAME_UID_ISOLATION_DISCLAIMER).toContain("same uid");
    expect(SAME_UID_ISOLATION_DISCLAIMER).toContain(
      "NOT OS-level key isolation",
    );
  });
});
