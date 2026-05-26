import { ActorType, type CaptureSession, type CaptureSourceType, type ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { isCaptureASRConfigured, transcribeCaptureAudioWithOpenAI } from "@/lib/conversation-capture/asr-provider";
import { jsonStringify } from "@/lib/utils";
import { type MemoryActorContext, splitIntoSentences } from "@/lib/memory/shared";

type CaptureContextSummary = {
  objectType?: ObjectType | null;
  objectId?: string | null;
  objectLabel?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  opportunityTitle?: string | null;
};

type BuildTranscriptInput = MemoryActorContext & {
  session: CaptureSession & {
    sourceType: CaptureSourceType;
  };
  transcriptText?: string | null;
  audioFile?: File | null;
  transcriptSegments?: Array<{ speaker: string; startedAt: number; endedAt: number; text: string }> | null;
  transcriptLanguage?: string | null;
  transcriptConfidence?: number | null;
  transcriptProvider?: string | null;
  transcriptModel?: string | null;
  context: CaptureContextSummary;
};

function buildFallbackTranscript(input: BuildTranscriptInput) {
  const label = input.context.objectLabel ?? input.session.title ?? "这次交流";

  if (input.context.opportunityTitle?.includes("方案") || input.context.companyName?.includes("星桥")) {
    return [
      `客户表示本次最关心的是付款周期和推进节奏，而非总价。`,
      `对方希望我们在下周三前先发一版精简方案结构，方便内部先过一轮。`,
      `采购侧还在等预算和财务口径确认，这一步如果不先收口，后面很难继续推进。`,
      `我们内部也要在两天内确认交付排期，否则外部承诺会失真。`,
      `${label} 会后建议先发结构草稿，再同步内部排期确认。`,
    ].join("\n");
  }

  if (input.context.opportunityTitle?.includes("岗位") || input.context.contactName) {
    return [
      `${input.context.contactName ?? "候选人"} 对岗位方向整体认可，但对薪资区间仍有顾虑。`,
      `用人方倾向继续推进，希望 48 小时内同步反馈，不希望流程拖太久。`,
      `如果本周不能把反馈和下一轮安排收口，候选人流失风险会上升。`,
      `${label} 会后建议先同步积极反馈，再单独讨论薪资边界。`,
    ].join("\n");
  }

  return [
    `${label} 中已经出现了明确下一步，但仍有一项关键阻塞没有收口。`,
    `对方愿意继续推进，不过希望我们先给出更清晰的下一步和时间窗口。`,
    `如果本周内不跟进，这次沟通形成的热度会明显下降。`,
    `建议先收口阻塞，再把后续动作送入审批或自动执行链路。`,
  ].join("\n");
}

function buildSegments(input: {
  text: string;
  contactName?: string | null;
}) {
  const lines = splitIntoSentences(input.text);
  const speakers = ["我方", input.contactName ?? "对方"];

  return lines.map((line, index) => ({
    speaker: speakers[index % speakers.length],
    startedAt: index * 12,
    endedAt: index * 12 + 10,
    text: line,
  }));
}

export async function generateConversationTranscript(input: BuildTranscriptInput) {
  const manualText = input.transcriptText?.trim() || "";
  let fullText = manualText;
  let sourceType: "MANUAL_TEXT" | "OPENAI_ASR" | "FALLBACK_DEMO" | "EXTERNAL_INGEST" =
    input.session.sourceType !== "MANUAL_CAPTURE" && manualText ? "EXTERNAL_INGEST" : "MANUAL_TEXT";
  let provider: string | null = input.transcriptProvider ?? null;
  let model: string | null = input.transcriptModel ?? null;
  let confidence = input.transcriptConfidence ?? (manualText ? 81 : 67);

  if (input.audioFile && isCaptureASRConfigured()) {
    try {
      const asr = await transcribeCaptureAudioWithOpenAI({
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        audioFile: input.audioFile,
        title: input.session.title,
        objectLabel: input.context.objectLabel,
        companyName: input.context.companyName,
        contactName: input.context.contactName,
        opportunityTitle: input.context.opportunityTitle,
      });

      fullText = asr.text;
      sourceType = asr.sourceType;
      provider = asr.provider;
      model = asr.model;
      confidence = asr.confidence;
    } catch {
      fullText = manualText || buildFallbackTranscript(input);
      sourceType = manualText
        ? input.session.sourceType !== "MANUAL_CAPTURE"
          ? "EXTERNAL_INGEST"
          : "MANUAL_TEXT"
        : "FALLBACK_DEMO";
      confidence = input.transcriptConfidence ?? (manualText ? 79 : 67);
    }
  } else if (!manualText) {
    fullText = buildFallbackTranscript(input);
    sourceType = "FALLBACK_DEMO";
    confidence = input.transcriptConfidence ?? 67;
  }

  const segments =
    input.transcriptSegments?.length
      ? input.transcriptSegments
      : buildSegments({
          text: fullText,
          contactName: input.context.contactName,
        });
  const speakerSeparated = new Set(segments.map((segment) => segment.speaker).filter(Boolean)).size > 1;

  const transcript = await db.conversationTranscript.upsert({
    where: {
      captureSessionId: input.session.id,
    },
    create: {
      workspaceId: input.workspaceId,
      captureSessionId: input.session.id,
      fullText,
      segments: jsonStringify(segments),
      speakerSeparated,
      language: input.transcriptLanguage || "zh-CN",
      confidence,
      sourceType,
      provider,
      model,
    },
    update: {
      fullText,
      segments: jsonStringify(segments),
      speakerSeparated,
      language: input.transcriptLanguage || "zh-CN",
      confidence,
      sourceType,
      provider,
      model,
    },
  });

  await db.captureSession.update({
    where: { id: input.session.id },
    data: {
      transcriptStatus: "COMPLETED",
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: input.actorType ?? ActorType.SYSTEM,
    actionType: "TRANSCRIPT_GENERATED",
    targetType: "CaptureSession",
    targetId: input.session.id,
    summary: `生成会话转写：${input.session.title ?? input.context.objectLabel ?? "现场记录"}`,
    payload: {
      segmentsCount: segments.length,
      confidence: transcript.confidence,
      transcriptSource: sourceType,
      speakerSeparated,
      provider,
      model,
      objectType: input.session.objectType,
      objectId: input.session.objectId,
    },
    sourcePage: input.sourcePage,
    relatedObjectType: input.session.objectType ?? undefined,
    relatedObjectId: input.session.objectId ?? undefined,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    eventName: "transcript_generated",
    eventCategory: "conversation_capture",
    targetType: "CaptureSession",
    targetId: input.session.id,
    metadata: {
      segmentsCount: segments.length,
      confidence: transcript.confidence,
      transcriptSource: sourceType,
      speakerSeparated,
      provider,
      model,
      objectType: input.session.objectType,
      objectId: input.session.objectId,
    },
    sourcePage: input.sourcePage,
  });

  return {
    transcript,
    lines: splitIntoSentences(fullText),
    segments,
  };
}
