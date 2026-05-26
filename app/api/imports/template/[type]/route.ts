import { NextResponse } from "next/server";
import { getImportConfig, type ImportType } from "@/lib/imports";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;

  if (!["contacts", "opportunities", "meetings"].includes(type)) {
    return new NextResponse("unsupported import type", { status: 400 });
  }

  const config = getImportConfig(type as ImportType);

  return new NextResponse(config.template, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"helm-${type}-template.csv\"`,
    },
  });
}
