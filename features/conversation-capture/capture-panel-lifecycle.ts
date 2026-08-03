export type CapturePanelStage = "idle" | "recording" | "processing" | "completed";

export function isCapturePanelCloseBlocked(
  stage: CapturePanelStage,
  transitionPending = false,
) {
  return transitionPending || stage === "recording" || stage === "processing";
}
