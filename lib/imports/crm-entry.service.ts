import { db } from "@/lib/db";
import { previewHubSpotImport, runHubSpotImport } from "@/lib/connectors/hubspot";
import { previewSalesforceImport, runSalesforceImport } from "@/lib/connectors/salesforce";
import { runImportWarmup } from "@/lib/imports/warmup.service";

export async function previewCrmImportSource(sourceId: string) {
  const source = await db.importSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error("导入来源不存在");
  }

  if (source.sourceType === "HUBSPOT") {
    return previewHubSpotImport(source.id);
  }

  if (source.sourceType === "SALESFORCE") {
    return previewSalesforceImport(source.id);
  }

  throw new Error(`当前来源 ${source.sourceType} 还不支持 CRM 预览`);
}

export async function runCrmImportSource(input: {
  sourceId: string;
  workspaceId: string;
  userId?: string | null;
  incremental?: boolean;
}) {
  const source = await db.importSource.findUnique({
    where: { id: input.sourceId },
  });

  if (!source) {
    throw new Error("导入来源不存在");
  }

  if (source.sourceType === "HUBSPOT") {
    return runHubSpotImport({
      sourceId: source.id,
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      incremental: input.incremental,
    });
  }

  if (source.sourceType === "SALESFORCE") {
    return runSalesforceImport({
      sourceId: source.id,
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      incremental: input.incremental,
    });
  }

  throw new Error(`当前来源 ${source.sourceType} 还不支持 CRM 导入`);
}

export async function rerunImportWarmup(input: {
  jobId: string;
  workspaceId: string;
  userId?: string | null;
}) {
  const job = await db.importJob.findUnique({
    where: { id: input.jobId },
    include: {
      source: true,
      items: true,
    },
  });

  if (!job || job.workspaceId !== input.workspaceId) {
    throw new Error("导入任务不存在");
  }

  const meetingIds = job.items
    .filter((item) => item.mappedObjectType === "Meeting" && item.mappedObjectId)
    .map((item) => item.mappedObjectId as string);
  const contactIds = job.items
    .filter((item) => item.mappedObjectType === "Contact" && item.mappedObjectId)
    .map((item) => item.mappedObjectId as string);
  const companyIds = job.items
    .filter((item) => item.mappedObjectType === "Company" && item.mappedObjectId)
    .map((item) => item.mappedObjectId as string);
  const opportunityIds = job.items
    .filter((item) => item.mappedObjectType === "Opportunity" && item.mappedObjectId)
    .map((item) => item.mappedObjectId as string);

  return runImportWarmup({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    sourceType: job.source.sourceType,
    jobId: job.id,
    meetingIds,
    contactIds,
    companyIds,
    opportunityIds,
  });
}
