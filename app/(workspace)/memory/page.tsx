import { MemoryClient } from "@/features/memory/memory-client";
import { loadMemoryPageData } from "@/features/memory/page-loader";

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string;
    dimension?: "ALL" | "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";
    objectLevel?: "ALL" | "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";
    source?: "ALL" | "HELM" | "OPENCLAW";
    objectType?: import("@prisma/client").ObjectType;
    objectId?: string;
    from?: string;
    approvalId?: string;
  }>;
}) {
  const memoryRouteIdentity = { sourcePage: "/memory" as const };
  const {
    data,
    entryContext,
    firstLoopModel,
    objectLevel,
    source,
    objectId,
    objectType,
    permissions,
    query,
    returnToApprovalId,
  } = await loadMemoryPageData(searchParams);

  return (
    <div data-source-page={memoryRouteIdentity.sourcePage}>
      <MemoryClient
        query={query}
        objectLevel={objectLevel}
        source={source}
        entryContext={entryContext}
        returnToApprovalId={returnToApprovalId}
        objectType={objectType}
        objectId={objectId}
        permissions={permissions}
        firstLoopModel={firstLoopModel}
        memoryEntries={data.memoryEntries}
        memoryFacts={data.memoryFacts}
        commitments={data.commitments}
        blockers={data.blockers}
        corrections={data.corrections}
        auditLogs={data.auditLogs}
        externalMemoryRecords={data.externalMemoryRecords}
        reflectionCandidates={data.reflectionCandidates}
        reflectionDecisions={data.reflectionDecisions}
        distillationCandidates={data.distillationCandidates}
        distillationDecisions={data.distillationDecisions}
      />
    </div>
  );
}
