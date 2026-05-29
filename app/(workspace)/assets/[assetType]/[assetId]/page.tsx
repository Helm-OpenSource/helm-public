import { notFound } from "next/navigation";
import { BusinessAssetDetailPage } from "@/features/business-assets/business-asset-detail-page";
import { loadBusinessAssetDetailPageData } from "@/features/business-assets/page-loader";

export default async function AssetDetailRoute({
  params,
}: {
  params: Promise<{ assetType: string; assetId: string }>;
}) {
  const { assetType, assetId } = await params;
  const data = await loadBusinessAssetDetailPageData({ assetType, assetId });

  if (!data) {
    return notFound();
  }

  return (
    <BusinessAssetDetailPage model={data.model} english={data.english} />
  );
}
