import { getCurrentWorkspaceSessionOrNull } from "@/lib/auth/session";
import { seatDeviceNotFound } from "@/lib/seat-device/device-routes";
import { handleSeatDeviceWebsiteList, handleSeatDeviceWebsiteRequest } from "@/lib/seat-device/website-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read only after the switch (and, for POST, the cross-site guard) passed.
async function memberSession() {
  const session = await getCurrentWorkspaceSessionOrNull();
  return session ? { authSessionId: session.authSessionId, userId: session.user.id } : null;
}

// D1 website side (design v0.3 §4.3): the device list; look up, approve, reject, revoke. 404 while HELM_SEAT_DEVICE_AUTH_ENABLED is off.
export function GET() {
  return handleSeatDeviceWebsiteList(memberSession);
}
export function POST(request: Request) {
  return handleSeatDeviceWebsiteRequest(request, memberSession);
}
// Any other method reads as an unknown route, also with no-store.
export { seatDeviceNotFound as PUT, seatDeviceNotFound as PATCH, seatDeviceNotFound as DELETE, seatDeviceNotFound as OPTIONS };
