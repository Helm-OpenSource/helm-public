/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioInputPicker } from "./audio-input-picker";

describe("AudioInputPicker", () => {
  it("shows the active external input, actual track shape, and input level", () => {
    render(
      <AudioInputPicker
        english={false}
        inputs={[
          {
            deviceId: "usb-1",
            label: "Insta360 Mic Pro",
            labelAvailable: true,
          },
        ]}
        selectedDeviceId="usb-1"
        status="active"
        activeProfile={{
          label: "Insta360 Mic Pro",
          sampleRate: 48_000,
          channelCount: 2,
        }}
        audioLevel={37}
        disabled
        onSelect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Insta360 Mic Pro")).toHaveLength(2);
    expect(screen.getByText("48 kHz · 2 声道")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "输入电平" })).toHaveAttribute(
      "aria-valuenow",
      "37",
    );
  });

  it("keeps the microphone-permission recovery action visible in English", () => {
    render(
      <AudioInputPicker
        english
        inputs={[]}
        selectedDeviceId=""
        status="permission_denied"
        activeProfile={null}
        audioLevel={0}
        onSelect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Permission blocked")).toBeInTheDocument();
    expect(
      screen.getByText("Allow microphone access, then detect again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Detect microphones" })).toBeEnabled();
  });
});
