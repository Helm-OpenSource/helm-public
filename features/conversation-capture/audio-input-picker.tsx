"use client";

import { AudioLines, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AudioInputOption, AudioTrackProfile } from "./audio-input";
import type { AudioInputStatus } from "./use-browser-audio-capture";

export function AudioInputPicker(props: {
  english: boolean;
  inputs: AudioInputOption[];
  selectedDeviceId: string;
  status: AudioInputStatus;
  activeProfile: AudioTrackProfile | null;
  audioLevel: number;
  disabled?: boolean;
  onSelect: (deviceId: string) => void;
  onRefresh: () => void;
}) {
  const copy = props.english
    ? {
        label: "Audio input",
        placeholder: "Choose a microphone",
        refresh: "Detect microphones",
        unchecked: "Not checked",
        checking: "Checking",
        ready: "Ready",
        active: "Live",
        permission_denied: "Permission blocked",
        unavailable: "No input",
        disconnected: "Disconnected",
        permissionHint: "Allow microphone access, then detect again.",
        unavailableHint: "Connect or enable a microphone, then detect again.",
        disconnectedHint: "The selected microphone is no longer available.",
        level: "Input level",
      }
    : {
        label: "音频输入",
        placeholder: "选择麦克风",
        refresh: "检测麦克风",
        unchecked: "未检测",
        checking: "检测中",
        ready: "可用",
        active: "采集中",
        permission_denied: "权限被阻止",
        unavailable: "没有输入",
        disconnected: "设备已断开",
        permissionHint: "允许浏览器使用麦克风后重新检测。",
        unavailableHint: "连接或启用麦克风后重新检测。",
        disconnectedHint: "当前选择的麦克风已不可用。",
        level: "输入电平",
      };

  const statusVariant =
    props.status === "active" || props.status === "ready"
      ? "approval"
      : props.status === "disconnected"
        ? "danger"
        : "warning";
  const profileMeta = formatProfileMeta(props.activeProfile, props.english);

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AudioLines className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <p className="text-sm font-medium text-[color:var(--foreground)]">{copy.label}</p>
          <Badge variant={statusVariant}>{copy[props.status]}</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={props.disabled || props.status === "checking"}
          aria-label={copy.refresh}
          title={copy.refresh}
          onClick={props.onRefresh}
        >
          <RefreshCw className={`h-4 w-4 ${props.status === "checking" ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {props.inputs.length ? (
        <Select
          value={props.selectedDeviceId || undefined}
          onValueChange={props.onSelect}
          disabled={props.disabled}
        >
          <SelectTrigger aria-label={copy.label}>
            <SelectValue placeholder={copy.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {props.inputs.map((input) => (
              <SelectItem key={input.deviceId} value={input.deviceId}>
                {input.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {props.status === "permission_denied" ? (
        <p className="text-sm text-[color:var(--status-warning-text)]">{copy.permissionHint}</p>
      ) : null}
      {props.status === "unavailable" ? (
        <p className="text-sm text-[color:var(--muted)]">{copy.unavailableHint}</p>
      ) : null}
      {props.status === "disconnected" ? (
        <p className="text-sm text-[color:var(--status-danger-text)]">{copy.disconnectedHint}</p>
      ) : null}

      {props.activeProfile ? (
        <div className="space-y-2" aria-live="polite">
          <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-[color:var(--muted-foreground)]">
            <span className="truncate">{props.activeProfile.label}</span>
            <span className="shrink-0">{profileMeta}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-subtle)]"
            role="meter"
            aria-label={copy.level}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={props.audioLevel}
          >
            <div
              className="h-full bg-[color:var(--accent)] transition-[width] duration-100"
              style={{ width: `${Math.max(2, props.audioLevel)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatProfileMeta(profile: AudioTrackProfile | null, english: boolean) {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.sampleRate) parts.push(`${Math.round(profile.sampleRate / 1_000)} kHz`);
  if (profile.channelCount) {
    parts.push(english ? `${profile.channelCount} ch` : `${profile.channelCount} 声道`);
  }
  return parts.join(" · ");
}
