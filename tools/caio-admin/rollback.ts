/**
 * caio-admin rollback — strictly ordered, database-preserving rollback:
 *
 *   1. disable ALL feature flags
 *   2. stop the new service
 *   3. validate the target old release (sealed + verifier passes)
 *   4. schema compatible  → switch active-release pointer + start old release
 *   5. schema incompatible → STAY STOPPED and block with
 *      blocked:restore_backup_required (database restore is always an
 *      explicit, owner-driven operation — never automatic)
 *
 * This module never resets a database: the ports expose no reset capability
 * and a test greps this source to keep it that way.
 */

import {
  type CaioAdminFinding,
  type CaioAdminResult,
  blockedResult,
  okResult,
} from "@/tools/caio-admin/contracts";

export interface RollbackPorts {
  featureFlags: {
    disableAll(): Promise<{ disabled: string[] }>;
  };
  service: {
    stop(): Promise<void>;
    start(releaseDir: string): Promise<void>;
  };
  releaseValidation: {
    /** Sealed + seal verifies for the target old release. */
    validate(releaseDir: string): Promise<{ valid: boolean; reason?: string }>;
  };
  schema: {
    /** Whether the old release can run against the CURRENT data schema. */
    isCompatibleWithCurrentData(releaseDir: string): Promise<boolean>;
  };
  activeRelease: {
    switchTo(releaseDir: string): Promise<void>;
  };
}

export interface RollbackInput {
  toRelease: string;
  ports: RollbackPorts;
}

export async function caioAdminRollback(input: RollbackInput): Promise<CaioAdminResult> {
  const { toRelease, ports } = input;
  const findings: CaioAdminFinding[] = [];

  // (1) Feature flags off first, so no half-active behavior survives.
  const flags = await ports.featureFlags.disableAll();
  findings.push({
    checkKey: "feature_flags_disabled",
    status: "ok",
    detail: `${flags.disabled.length} flags disabled`,
  });

  // (2) Stop the new service before touching the pointer.
  await ports.service.stop();
  findings.push({ checkKey: "service_stopped", status: "ok", detail: "service stopped" });

  // (3) Validate the target old release.
  const validation = await ports.releaseValidation.validate(toRelease);
  if (!validation.valid) {
    return blockedResult("rollback", "invalid_rollback_target", {
      findings: [
        ...findings,
        {
          checkKey: "target_release",
          status: "fail",
          detail: validation.reason ?? "target release invalid",
        },
      ],
      detail: { toRelease, serviceState: "stopped" },
    });
  }
  findings.push({ checkKey: "target_release", status: "ok", detail: "target sealed and valid" });

  // (4)/(5) Schema gate.
  const compatible = await ports.schema.isCompatibleWithCurrentData(toRelease);
  if (!compatible) {
    // Stay stopped. Restoring data is an explicit owner decision; this
    // command never restores a backup and never wipes state on its own.
    return blockedResult("rollback", "restore_backup_required", {
      findings: [
        ...findings,
        {
          checkKey: "schema_compatibility",
          status: "fail",
          detail:
            "old release incompatible with current data schema; service left stopped, owner must restore the pre-upgrade backup explicitly",
        },
      ],
      detail: { toRelease, serviceState: "stopped" },
    });
  }

  await ports.activeRelease.switchTo(toRelease);
  await ports.service.start(toRelease);
  findings.push({ checkKey: "service_started", status: "ok", detail: "old release started" });

  return okResult("rollback", {
    findings,
    detail: { toRelease, serviceState: "running" },
  });
}
