import { handleSeatDeviceRequest, seatDeviceNotFound } from "@/lib/seat-device/device-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// D1 seat desktop device endpoint: request authorization (design v0.3 §4.2). 404 while HELM_SEAT_DEVICE_AUTH_ENABLED is off.
export function POST(request: Request) {
  return handleSeatDeviceRequest("authorize", request);
}
// Any other method reads as an unknown route, also with no-store.
export { seatDeviceNotFound as GET, seatDeviceNotFound as PUT, seatDeviceNotFound as PATCH, seatDeviceNotFound as DELETE, seatDeviceNotFound as OPTIONS };
