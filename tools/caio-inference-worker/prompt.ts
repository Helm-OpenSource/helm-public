// The shared CAIO inference prompt is owned by lib/caio-inference/prompt.ts so the device worker and the
// in-process governed provider adapter ask the model the same question.
export { buildCaioInferencePrompt as buildCaioWorkerPrompt } from "@/lib/caio-inference/prompt";
