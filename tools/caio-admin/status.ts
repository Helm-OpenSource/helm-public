/**
 * caio-admin status — five INDEPENDENT sections. Package, configuration,
 * runtime, activation and blocked[] are computed from separate ports and are
 * never conflated: an installed-but-unconfigured host must report package ok,
 * configuration missing, runtime stopped and activation none simultaneously.
 */

import {
  type CaioAdminResult,
  okResult,
} from "@/tools/caio-admin/contracts";
import { type ActivationPhase } from "@/tools/caio-admin/activate";

export type PackageSectionState = "ok" | "missing" | "broken";
export type ConfigurationSectionState = "ok" | "missing" | "invalid";
export type RuntimeSectionState = "running" | "stopped" | "unknown";
export type ActivationSectionState = "none" | "partial" | "full";

export interface StatusSections {
  package: { state: PackageSectionState; activeRelease?: string };
  configuration: { state: ConfigurationSectionState };
  runtime: { state: RuntimeSectionState };
  activation: { state: ActivationSectionState; phases: ActivationPhase[] };
  blocked: Array<{ section: string; reason: string }>;
}

export interface StatusPorts {
  packageSection(): Promise<{ state: PackageSectionState; activeRelease?: string }>;
  configurationSection(): Promise<{ state: ConfigurationSectionState }>;
  runtimeSection(): Promise<{ state: RuntimeSectionState }>;
  activationSection(): Promise<{ state: ActivationSectionState; phases: ActivationPhase[] }>;
}

export async function caioAdminStatus(ports: StatusPorts): Promise<CaioAdminResult> {
  const sections: StatusSections = {
    package: { state: "missing" },
    configuration: { state: "missing" },
    runtime: { state: "unknown" },
    activation: { state: "none", phases: [] },
    blocked: [],
  };

  // Each section is read independently; one failing probe never masks the
  // others — it lands in blocked[] and its section degrades in isolation.
  try {
    sections.package = await ports.packageSection();
  } catch (error) {
    sections.package = { state: "broken" };
    sections.blocked.push({ section: "package", reason: describe(error) });
  }
  try {
    sections.configuration = await ports.configurationSection();
  } catch (error) {
    sections.configuration = { state: "invalid" };
    sections.blocked.push({ section: "configuration", reason: describe(error) });
  }
  try {
    sections.runtime = await ports.runtimeSection();
  } catch (error) {
    sections.runtime = { state: "unknown" };
    sections.blocked.push({ section: "runtime", reason: describe(error) });
  }
  try {
    sections.activation = await ports.activationSection();
  } catch (error) {
    sections.activation = { state: "none", phases: [] };
    sections.blocked.push({ section: "activation", reason: describe(error) });
  }

  return okResult("status", {
    detail: { sections: sections as unknown as Record<string, unknown> },
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
