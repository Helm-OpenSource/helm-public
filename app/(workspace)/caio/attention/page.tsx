import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { CaioAttentionCaseList } from "@/features/caio-attention/case-list";
import { caioAttentionCopy } from "@/features/caio-attention/copy";
import { getCaioAttentionPageContext } from "@/features/caio-attention/page-context";
import { getCaioAttentionPageService, isCaioAttentionPageServiceAvailable } from "@/features/caio-attention/service";
import { CAIO_ATTENTION_PAGE_SIZE, parseCaioAttentionPageParam } from "@/features/caio-attention/view-model";

// Attention queue: every case this viewer may read, pending first, paged. Filtering happens in the loader.
export default async function CaioAttentionQueuePage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const [{ english, viewer }, params] = await Promise.all([getCaioAttentionPageContext(), searchParams]);
  const copy = caioAttentionCopy(english);
  const result = await getCaioAttentionPageService().listCases({
    viewer,
    scope: "queue",
    page: parseCaioAttentionPageParam(params.page),
    pageSize: CAIO_ATTENTION_PAGE_SIZE,
  });
  return (
    <div className="space-y-6" data-source-page="/caio/attention">
      <PageHeader
        english={english}
        eyebrow={copy.eyebrow}
        title={copy.queueTitle}
        description={copy.queueDescription}
        actions={<Link href="/caio/attention/mine">{copy.viewMine}</Link>}
      />
      <CaioAttentionCaseList result={result} english={english} basePath="/caio/attention" serviceBound={isCaioAttentionPageServiceAvailable()} />
    </div>
  );
}
