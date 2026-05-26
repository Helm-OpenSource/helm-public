"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, Mic, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCaptureDisplayText } from "@/features/conversation-capture/display-copy";

type CaptureSessionPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectType?: "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";
  objectId?: string;
  objectLabel?: string;
  defaultTitle?: string;
};

type PanelStage = "idle" | "recording" | "processing" | "completed";

export function CaptureSessionPanel({
  open,
  onOpenChange,
  objectType,
  objectId,
  objectLabel,
  defaultTitle,
}: CaptureSessionPanelProps) {
  const router = useRouter();
  const { locale, messages, captureConsentRequired } = useWorkspaceUi();
  const english = locale === "en-US";
  const buildDefaultTitle = () =>
    defaultTitle ??
    (objectLabel
      ? `${objectLabel} ${english ? "live capture" : "现场记录"}`
      : english
        ? "Live capture"
        : "现场记录");
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<PanelStage>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [title, setTitle] = useState(buildDefaultTitle);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [captureMode, setCaptureMode] = useState<"audio" | "notes">("audio");
  const [audioMeta, setAudioMeta] = useState<{
    mimeType: string;
    sizeKb: number;
  } | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [summary, setSummary] = useState<{
    factCount: number;
    commitmentCount: number;
    blockerCount: number;
    actionCount: number;
    recommendationObjectCount: number;
    approvalCount: number;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const copy = {
    panelTitle: english ? "Start capture" : "开始记录",
    panelDescription: english
      ? "This is not just a recorder. Once you stop, Helm will turn the transcript into facts, commitments, blockers and follow-up actions."
      : "这不是一个录音工具。结束记录后，Helm 会把转写文本转成事实、承诺、阻塞和后续动作。",
    entryBadge: english ? "Live capture entry" : "现场记录入口",
    currentObject: english ? "Current object:" : "当前对象：",
    classifyLater: english ? "Classify later" : "稍后归类",
    browserMvp: english ? "Browser audio MVP" : "浏览器录音 MVP",
    entryDescription: english
      ? "Open it during customer calls, candidate conversations, partnership discussions or internal priority sessions. The front-end only handles start and stop; the backend handles transcription, understanding and writeback. If the device cannot record audio, it automatically falls back to note mode."
      : "适合在客户会、候选人沟通、合作讨论和内部优先级会话里直接打开。前台只做开始与结束，后台会自动完成转写、理解和写回；如果当前设备不支持录音，会自动回退到速记模式。",
    titleLabel: english ? "Session title" : "会话标题",
    titlePlaceholder: english
      ? "Example: Payment timing alignment with Starbridge"
      : "例如：星桥科技付款节奏沟通",
    start: messages.capture.start,
    recording: english ? "Recording from microphone" : "麦克风录音中",
    noteMode: english ? "Notes-only mode" : "速记模式记录中",
    audioHint: english
      ? "The session will upload real audio when you stop, and will prefer a live ASR provider. If ASR is unavailable, it falls back to your notes or the demo transcript."
      : "当前会在结束记录时上传真实音频，并优先走真实语音转写。若语音转写不可用，会自动回退到速记文本或兜底转写。",
    notesHint: english
      ? "No usable microphone is available, so the system will continue with your typed notes."
      : "当前没有拿到可用麦克风，Helm 会改用你输入的速记文本继续打通后续链路。",
    transcriptLabel: english
      ? "Notes / transcript draft"
      : "现场速记 / 转写草稿",
    transcriptPlaceholder: english
      ? "Paste live notes here. If ASR is unavailable, Helm will prefer this text; if this is also empty, it falls back to the demo transcript."
      : "可以直接粘贴现场速记。若真实语音转写不可用，Helm 会优先使用这里的文本；如果这里也为空，才会回退到演示转写。",
    stop: english ? "Stop and process" : "结束记录并处理",
    close: english ? "Close for now" : "稍后继续",
    processing: english ? "Processing capture" : "正在处理现场记录",
    processingSteps: english
      ? [
          `1. Generating transcript${captureMode === "audio" ? " (preferring live ASR)" : " (preferring your note draft)"}`,
          "2. Extracting facts, commitments, blockers and risks",
          "3. Writing results back to meetings, memory, recommendations and approvals",
          "4. The UI is not streaming step-by-step yet; it will return the full result once complete",
        ]
      : [
          `1. 正在生成转写文本${captureMode === "audio" ? "（优先走真实语音转写）" : "（优先使用你的速记文本）"}`,
          "2. 正在提取事实、承诺、阻塞与风险",
          "3. 正在把结果写回会议、记忆、推荐与审批",
          "4. 当前不会实时流式展示，完成后会直接给出完整处理结果",
        ],
    completed: english
      ? "Capture finished and usable information was written back"
      : "现场记录已完成，会后可用信息已写回",
    uploadedAudio: english ? "Uploaded audio:" : "已上传音频：",
    facts: english ? "Facts" : "事实",
    commitments: english ? "Commitments" : "承诺",
    blockers: english ? "Blockers" : "阻塞",
    actions: english ? "Actions" : "动作",
    refreshedObjects: english
      ? "Refreshed recommendation objects"
      : "刷新建议对象",
    approvals: english ? "Approvals" : "进入审批",
    openResult: english ? "Open full result" : "查看完整结果",
    openMeeting: english ? "Open linked meeting" : "查看关联会议",
  };

  const releaseMediaResources = () => {
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const elapsed = useMemo(() => {
    if (!startedAt || !currentTime) return "00:00";
    const total = Math.max(0, Math.floor((currentTime - startedAt) / 1000));
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [currentTime, startedAt]);

  useEffect(() => {
    if (stage !== "recording") return;
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => () => releaseMediaResources(), []);

  const startBrowserRecording = async () => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setCaptureMode("notes");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const selectedMimeType = preferredMimeTypes.find((mimeType) =>
        typeof MediaRecorder.isTypeSupported === "function"
          ? MediaRecorder.isTypeSupported(mimeType)
          : false,
      );
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setCaptureMode("audio");
      return true;
    } catch {
      setCaptureMode("notes");
      return false;
    }
  };

  const stopBrowserRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseMediaResources();
      return null;
    }

    return new Promise<File | null>((resolve) => {
      const mimeType =
        recorder.mimeType || mediaChunksRef.current[0]?.type || "audio/webm";
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: mimeType });
        releaseMediaResources();
        if (!blob.size) {
          resolve(null);
          return;
        }

        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `capture-${Date.now()}.${extension}`, {
          type: mimeType,
        });
        setAudioMeta({
          mimeType,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
        });
        resolve(file);
      };

      recorder.stop();
    });
  };

  const resetPanel = () => {
    releaseMediaResources();
    setStage("idle");
    setSessionId(null);
    setMeetingId(null);
    setTranscriptDraft("");
    setCaptureMode("audio");
    setAudioMeta(null);
    setConsentConfirmed(false);
    setSummary(null);
    setStartedAt(null);
    setCurrentTime(null);
    setTitle(buildDefaultTitle());
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetPanel();
    }
    onOpenChange(nextOpen);
  };

  const handleStart = () => {
    if (captureConsentRequired && !consentConfirmed) {
      toast.error(
        english
          ? "Consent confirmation is required before live capture starts"
          : "开始现场记录前需要先确认授权边界",
      );
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/conversation-capture/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          objectType,
          objectId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.error(
          payload.message ??
            (english ? "Failed to start capture" : "开始记录失败"),
        );
        return;
      }
      setSessionId(payload.data.id);
      setStage("recording");
      const now = Date.now();
      setStartedAt(now);
      setCurrentTime(now);
      const audioStarted = await startBrowserRecording();
      if (audioStarted) {
        toast.success(
          english
            ? "Capture started. Real audio is being collected and will enter the ASR + operating-understanding pipeline when you stop."
            : "现场记录已开始，正在采集真实音频，结束后会进入语音转写与经营理解链路。",
        );
      } else {
        toast.success(
          english
            ? "Capture started, but microphone audio is unavailable (usually a browser mic permission or device issue). Switched to note mode — paste a transcript to continue. To use audio next time, allow mic access in your browser settings."
            : "现场记录已开始，但无法采集麦克风音频（通常是浏览器麦克风权限或设备问题）。已切到速记模式，可粘贴转写继续；如需录音，请到浏览器设置开启麦克风权限后重试。",
        );
      }
    });
  };

  const handleStop = () => {
    if (!sessionId) return;

    startTransition(async () => {
      setStage("processing");
      const audioFile = await stopBrowserRecording();
      const response = await fetch(
        `/api/conversation-capture/${sessionId}/stop`,
        {
          method: "POST",
          body: (() => {
            if (audioFile) {
              const formData = new FormData();
              formData.set("title", title);
              if (transcriptDraft.trim()) {
                formData.set("transcriptText", transcriptDraft.trim());
              }
              formData.set("audio", audioFile);
              return formData;
            }

            return JSON.stringify({
              title,
              transcriptText: transcriptDraft,
            });
          })(),
          headers: audioFile
            ? undefined
            : {
                "Content-Type": "application/json",
              },
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setStage("recording");
        toast.error(
          payload.message ??
            (english ? "Failed to stop capture" : "结束记录失败"),
        );
        return;
      }
      const result = payload.data;
      setMeetingId(result.meetingId ?? null);
      setSummary({
        factCount:
          result.insights?.filter(
            (item: { insightType: string }) => item.insightType === "FACT",
          ).length ?? 0,
        commitmentCount:
          result.insights?.filter(
            (item: { insightType: string }) =>
              item.insightType === "COMMITMENT",
          ).length ?? 0,
        blockerCount:
          result.insights?.filter(
            (item: { insightType: string }) => item.insightType === "BLOCKER",
          ).length ?? 0,
        actionCount: result.createdActions?.length ?? 0,
        recommendationObjectCount: result.refreshedRecommendations?.length ?? 0,
        approvalCount: result.approvalCount ?? 0,
      });
      setStage("completed");
      router.refresh();
      toast.success(
        english
          ? "Capture processed successfully. Usable information was written back to work objects."
          : "现场记录已处理完成，可用信息已写回工作对象。",
      );
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="max-w-[560px]"
        closeLabel={english ? "Close capture panel" : "关闭现场记录面板"}
      >
        <SheetHeader>
          <SheetTitle>{copy.panelTitle}</SheetTitle>
          <SheetDescription>{copy.panelDescription}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="workspace-panel-muted rounded-2xl px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="approval">{copy.entryBadge}</Badge>
              {objectLabel ? (
                <Badge variant="info">
                  {copy.currentObject}
                  {objectLabel}
                </Badge>
              ) : (
                <Badge variant="neutral">{copy.classifyLater}</Badge>
              )}
              <Badge variant="neutral">{copy.browserMvp}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {copy.entryDescription}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {copy.titleLabel}
            </p>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={copy.titlePlaceholder}
            />
          </div>

          {captureConsentRequired && stage === "idle" ? (
            <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--status-warning-text)]">
                {messages.capture.consentTitle}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--status-warning-text)]">
                {messages.capture.consentDescription}
              </p>
              <div className="workspace-panel mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                <p className="text-sm text-[color:var(--foreground)]">
                  {messages.capture.consentCheckbox}
                </p>
                <Switch
                  checked={consentConfirmed}
                  onCheckedChange={setConsentConfirmed}
                />
              </div>
            </div>
          ) : null}

          {stage === "idle" ? (
            <Button
              className="w-full"
              disabled={
                pending || (captureConsentRequired && !consentConfirmed)
              }
              onClick={handleStart}
            >
              <Mic className="h-4 w-4" />
              {copy.start}
            </Button>
          ) : null}

          {stage === "recording" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-[color:var(--status-success-text)]" />
                  <p className="text-sm font-medium text-[color:var(--status-success-text)]">
                    {captureMode === "audio" ? copy.recording : copy.noteMode}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[color:var(--status-success-text)]">
                  <Clock3 className="h-4 w-4" />
                  {elapsed}
                </div>
              </div>

              <div className="workspace-panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                {captureMode === "audio" ? copy.audioHint : copy.notesHint}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {copy.transcriptLabel}
                </p>
                <Textarea
                  value={transcriptDraft}
                  onChange={(event) => setTranscriptDraft(event.target.value)}
                  placeholder={copy.transcriptPlaceholder}
                  className="min-h-[220px]"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  disabled={pending}
                  onClick={handleStop}
                >
                  {copy.stop}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => handleOpenChange(false)}
                >
                  {copy.close}
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "processing" ? (
            <div className="workspace-panel-muted space-y-4 rounded-2xl px-4 py-5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {copy.processing}
                </p>
              </div>
              <div className="space-y-2 text-sm text-[color:var(--muted)]">
                {copy.processingSteps.map((step) => (
                  <p key={step}>{formatCaptureDisplayText(step, english)}</p>
                ))}
              </div>
            </div>
          ) : null}

          {stage === "completed" ? (
            <div className="space-y-4">
              <div className="workspace-panel-muted rounded-2xl px-4 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {copy.completed}
                  </p>
                </div>
                {audioMeta ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]">
                    <UploadCloud className="h-3.5 w-3.5" />
                    {copy.uploadedAudio}
                    {audioMeta.mimeType} · {audioMeta.sizeKb} KB
                  </div>
                ) : null}
                {summary ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    <SummaryStat label={copy.facts} value={summary.factCount} />
                    <SummaryStat
                      label={copy.commitments}
                      value={summary.commitmentCount}
                    />
                    <SummaryStat
                      label={copy.blockers}
                      value={summary.blockerCount}
                    />
                    <SummaryStat
                      label={copy.actions}
                      value={summary.actionCount}
                    />
                    <SummaryStat
                      label={copy.refreshedObjects}
                      value={summary.recommendationObjectCount}
                    />
                    <SummaryStat
                      label={copy.approvals}
                      value={summary.approvalCount}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {sessionId ? (
                  <Button asChild>
                    <Link href={`/capture?sessionId=${sessionId}`}>
                      {copy.openResult}
                    </Link>
                  </Button>
                ) : null}
                {meetingId ? (
                  <Button variant="secondary" asChild>
                    <Link href={`/meetings/${meetingId}`}>
                      {copy.openMeeting}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="workspace-panel rounded-2xl px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
