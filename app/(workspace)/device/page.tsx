import { notFound } from "next/navigation";
import { DeviceConfirmClient } from "@/features/seat-device/device-confirm-client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isSeatDeviceAuthDeploymentEnabled } from "@/lib/seat-device/contract";

export const dynamic = "force-dynamic";
export const metadata = { title: "授权坐席客户端", robots: { index: false, follow: false }, referrer: "no-referrer" };

// D1 verification page (design v0.3 §4.3): the member types the pairing code
// shown by the seat desktop client; the URL never carries it. Framing is
// refused in next.config.ts.
export default async function SeatDeviceVerificationPage() {
  if (!isSeatDeviceAuthDeploymentEnabled()) notFound();
  await getCurrentWorkspaceSession();
  return <section className="mx-auto max-w-xl p-6"><DeviceConfirmClient /></section>;
}
