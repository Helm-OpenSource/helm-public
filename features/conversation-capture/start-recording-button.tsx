"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Button } from "@/components/ui/button";
import { CaptureSessionPanel } from "@/features/conversation-capture/capture-session-panel";

export function StartRecordingButton(props: {
  objectType?: "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";
  objectId?: string;
  objectLabel?: string;
  defaultTitle?: string;
  variant?: "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
  labelClassName?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { messages } = useWorkspaceUi();

  return (
    <>
      <Button
        variant={props.variant}
        size={props.size}
        className={props.className}
        title={props.title}
        aria-label={props.ariaLabel ?? props.label ?? props.title ?? messages.capture.start}
        onClick={() => setOpen(true)}
      >
        <Mic className="h-4 w-4" />
        <span className={props.labelClassName}>{props.label ?? messages.capture.start}</span>
      </Button>
      <CaptureSessionPanel
        open={open}
        onOpenChange={setOpen}
        objectType={props.objectType}
        objectId={props.objectId}
        objectLabel={props.objectLabel}
        defaultTitle={props.defaultTitle}
      />
    </>
  );
}
