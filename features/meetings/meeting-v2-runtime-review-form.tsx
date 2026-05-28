"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingV2RuntimeReviewPayload, MeetingV2RuntimeReviewMode } from "@/features/meetings/meeting-v2-runtime-shared";

type MeetingV2RuntimeReviewFormProps = {
  english: boolean;
  pending: boolean;
  defaultFactsJson: string;
  defaultActionPackMarkdown: string;
  defaultReviewNotes: string;
  onSubmit: (payload: MeetingV2RuntimeReviewPayload) => void;
};

export function MeetingV2RuntimeReviewForm({
  english,
  pending,
  defaultFactsJson,
  defaultActionPackMarkdown,
  defaultReviewNotes,
  onSubmit,
}: MeetingV2RuntimeReviewFormProps) {
  const [factsJson, setFactsJson] = useState(defaultFactsJson);
  const [actionPackMarkdown, setActionPackMarkdown] = useState(defaultActionPackMarkdown);
  const [reviewNotes, setReviewNotes] = useState(defaultReviewNotes);

  const submit = (mode: MeetingV2RuntimeReviewMode) => {
    onSubmit({
      mode,
      factsJson,
      actionPackMarkdown,
      reviewNotes,
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "confirmed facts json" : "confirmed facts json"}</p>
        <Textarea value={factsJson} onChange={(event) => setFactsJson(event.target.value)} rows={12} className="mt-2 font-mono text-xs" />
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "action pack markdown" : "action pack markdown"}</p>
        <Textarea
          value={actionPackMarkdown}
          onChange={(event) => setActionPackMarkdown(event.target.value)}
          rows={14}
          className="mt-2 font-mono text-xs"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "review notes" : "review notes"}</p>
        <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} className="mt-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => submit("keep_draft")} disabled={pending}>
          {english ? "Keep as draft" : "保留为 draft"}
        </Button>
        <Button variant="secondary" onClick={() => submit("reject")} disabled={pending}>
          <ShieldAlert className="h-4 w-4" />
          {english ? "Reject" : "驳回"}
        </Button>
        <Button variant="secondary" onClick={() => submit("edit_confirm")} disabled={pending}>
          <Sparkles className="h-4 w-4" />
          {english ? "Edit then confirm" : "编辑后确认"}
        </Button>
        <Button onClick={() => submit("confirm")} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Confirm" : "确认"}
        </Button>
      </div>
    </div>
  );
}
