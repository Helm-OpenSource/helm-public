import { NextResponse } from "next/server";
import { normalizeClientRuntimeErrorTelemetry } from "@/lib/client-runtime-error-recovery";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizeClientRuntimeErrorTelemetry(body);

    console.error("[client-runtime-error]", {
      ...payload,
      recordedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[client-runtime-error] failed to record", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
