import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { CaioAttentionCaseList } from "@/features/caio-attention/case-list";
import { caioAttentionCopy } from "@/features/caio-attention/copy";
import { getCaioAttentionPageContext } from "@/features/caio-attention/page-context";
import { CAIO_ATTENTION_PAGE_SERVICE_BOUND, getCaioAttentionPageService } from "@/features/caio-attention/service";
import { CAIO_ATTENTION_PAGE_SIZE, parseCaioAttentionPageParam } from "@/features/caio-attention/view-model";

// "My attention cases": only cases where the viewer is a participant of the current confirmed command.
export default async function CaioAttentionMinePage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const [{ english, viewer }, params] = await Promise.all([getCaioAttentionPageContext(), searchParams]);
  const copy = caioAttentionCopy(english);
  const result = await getCaioAttentionPageService().listCases({
    viewer,
    scope: "mine",
    page: parseCaioAttentionPageParam(params.page),
    pageSize: CAIO_ATTENTION_PAGE_SIZE,
  });
  return (
    <div className="space-y-6" data-source-page="/caio/attention/mine">
      <PageHeader
        english={english}
        eyebrow={copy.eyebrow}
        title={copy.mineTitle}
        description={copy.mineDescription}
        actions={<Link href="/caio/attention">{copy.viewQueue}</Link>}
      />
      <CaioAttentionCaseList result={result} english={english} basePath="/caio/attention/mine" serviceBound={CAIO_ATTENTION_PAGE_SERVICE_BOUND} />
    </div>
  );
}
