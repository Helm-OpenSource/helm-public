import { notFound } from "next/navigation";
import { SeatDevicesClient } from "@/features/seat-device/seat-devices-client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isSeatDeviceAuthDeploymentEnabled } from "@/lib/seat-device/contract";

export const dynamic = "force-dynamic";
export const metadata = { title: "坐席客户端设备", robots: { index: false, follow: false }, referrer: "no-referrer" };

// D1 device list (design v0.3 §4.3): the member's own devices, every device of
// the workspace for OWNER/ADMIN, each revocable. Framing is refused in next.config.ts.
export default async function SeatDevicesPage() {
  if (!isSeatDeviceAuthDeploymentEnabled()) notFound();
  await getCurrentWorkspaceSession();
  return <section className="p-6"><SeatDevicesClient /></section>;
}
