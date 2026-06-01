"use client";

import {
  BarChart3,
  Boxes,
  Compass,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { WorkspaceNavExtensionIconKey } from "@/lib/extensions/registry";

/**
 * Map a registry-side icon key (string) to a lucide icon component.
 * Centralizes the bridge so server-side resolvers don't need to traffic in
 * ReactNode across the server→client boundary.
 *
 * Adding a new key requires updating both `WorkspaceNavExtensionIconKey` in
 * `lib/extensions/registry.tsx` and the switch below.
 */
export function ExtensionNavIcon({
  iconKey,
  className,
}: {
  iconKey: WorkspaceNavExtensionIconKey;
  className?: string;
}) {
  const cls = className ?? "h-4 w-4";
  switch (iconKey) {
    case "shield-check":
      return <ShieldCheck className={cls} />;
    case "chart":
      return <BarChart3 className={cls} />;
    case "users":
      return <Users className={cls} />;
    case "rocket":
      return <Rocket className={cls} />;
    case "boxes":
      return <Boxes className={cls} />;
    case "compass":
    default:
      return <Compass className={cls} />;
  }
}
