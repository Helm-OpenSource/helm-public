#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relativeBinaryPath =
  "node_modules/lightningcss-darwin-arm64/lightningcss.darwin-arm64.node";
const binaryPath = path.join(root, relativeBinaryPath);

function log(message) {
  process.stdout.write(`[postinstall] ${message}\n`);
}

function warn(message) {
  process.stderr.write(`[postinstall] ${message}\n`);
}

function shouldResign() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    return {
      ok: false,
      reason: "skip lightningcss re-sign because host is not macOS arm64",
    };
  }

  if (!existsSync(binaryPath)) {
    return {
      ok: false,
      reason: `skip lightningcss re-sign because ${relativeBinaryPath} is not installed`,
    };
  }

  return { ok: true };
}

function runCodesign(args) {
  return spawnSync("codesign", args, {
    encoding: "utf8",
    stdio: "pipe",
  });
}

function formatCodesignFailure(result) {
  if (result.error) {
    return result.error.message;
  }

  const stderr = result.stderr?.trim();
  const stdout = result.stdout?.trim();
  return stderr || stdout || `exit code ${result.status ?? "unknown"}`;
}

function main() {
  const eligibility = shouldResign();
  if (!eligibility.ok) {
    log(eligibility.reason);
    return 0;
  }

  const removeSignature = runCodesign(["--remove-signature", binaryPath]);
  if (removeSignature.error?.code === "ENOENT") {
    warn("skip lightningcss re-sign because codesign is unavailable on this machine");
    return 0;
  }

  if (
    removeSignature.status !== 0 &&
    !formatCodesignFailure(removeSignature).includes("code object is not signed at all")
  ) {
    warn(
      `continuing after lightningcss signature removal warning: ${formatCodesignFailure(removeSignature)}`,
    );
  }

  const resign = runCodesign(["--force", "--sign", "-", binaryPath]);
  if (resign.error?.code === "ENOENT") {
    warn("skip lightningcss re-sign because codesign is unavailable on this machine");
    return 0;
  }

  if (resign.status !== 0) {
    warn(`lightningcss re-sign failed: ${formatCodesignFailure(resign)}`);
    return 0;
  }

  log(`re-signed ${relativeBinaryPath} for local macOS arm64 builds`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}

export { formatCodesignFailure, relativeBinaryPath, shouldResign };
