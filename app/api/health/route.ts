export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  return Response.json(
    {
      success: true,
      data: {
        status: "ok",
        service: "helm",
        scope: "public-runtime-reachability",
        checks: {
          http: "ok",
        },
        boundaries: {
          authenticatedDetailsIncluded: false,
          businessDataIncluded: false,
          piiIncluded: false,
          rawLogsIncluded: false,
        },
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
