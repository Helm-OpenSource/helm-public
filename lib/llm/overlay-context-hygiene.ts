/**
 * Overlay Context Hygiene — public contract + reference prompt-injection scanner.
 *
 * Ownership (fixed by owner decision):
 *   - public Core : this contract, the reference scanner, synthetic fixtures.
 *   - private overlay repo / local : real scan execution over private context.
 *
 * An `OverlayContextFileReceipt` records which context refs were read, which
 * were excluded, the source / policy snapshot hashes, and the result of a
 * prompt-injection scan over the file. The scan status may be `skipped` ONLY
 * for synthetic fixtures; a real overlay / local receipt that reports
 * `skipped` is rejected at parse time (and by the static guard).
 *
 * The reference scanner is deterministic and offline. It is intentionally
 * conservative (prefers `failed` over a false `passed`) so that overlays have a
 * known-good baseline to read before pointing it at private content.
 */

import { z } from "zod";

export const PROMPT_INJECTION_SCAN_STATUSES = ["passed", "failed", "skipped"] as const;
export type PromptInjectionScanStatus = (typeof PROMPT_INJECTION_SCAN_STATUSES)[number];

export const promptInjectionScanResultSchema = z
  .object({
    status: z.enum(PROMPT_INJECTION_SCAN_STATUSES),
    skipReason: z.string().min(1).optional(),
    hitPatternIds: z.array(z.string().min(1)).default([]),
  })
  .refine((value) => value.status !== "skipped" || Boolean(value.skipReason), {
    message: "promptInjectionScanResult.status=skipped requires skipReason",
    path: ["skipReason"],
  });
export type PromptInjectionScanResult = z.infer<typeof promptInjectionScanResultSchema>;

export const overlayContextFileReceiptSchema = z.object({
  readRefs: z.array(z.string().min(1)).default([]),
  excludedRefs: z.array(z.string().min(1)).default([]),
  sourceHash: z.string().min(1),
  policySnapshotHash: z.string().min(1),
  promptInjectionScanResult: promptInjectionScanResultSchema,
});
export type OverlayContextFileReceipt = z.infer<typeof overlayContextFileReceiptSchema>;

export type OverlayReceiptOrigin = "synthetic_fixture" | "real";

/**
 * Parse an OverlayContextFileReceipt. For a real overlay / local origin, a
 * `skipped` prompt-injection status is rejected — real receipts must carry a
 * concrete passed / failed scan result. Only synthetic fixtures may use
 * `skipped`.
 */
export function parseOverlayContextFileReceipt(
  input: unknown,
  options: { origin: OverlayReceiptOrigin },
): OverlayContextFileReceipt {
  const receipt = overlayContextFileReceiptSchema.parse(input);
  if (options.origin === "real" && receipt.promptInjectionScanResult.status === "skipped") {
    throw new Error(
      "overlay_context_receipt_skipped_not_allowed: a real overlay/local receipt must not report a skipped prompt-injection scan.",
    );
  }
  return receipt;
}

/**
 * Reference prompt-injection patterns. Deterministic and intentionally broad.
 * These match common instruction-override / exfiltration / role-escape phrasing
 * in both English and Chinese context text.
 */
const PROMPT_INJECTION_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "ignore_previous", re: /ignore (?:all )?(?:the )?(?:previous|prior|above) (?:instructions|prompt)/i },
  { id: "disregard_rules", re: /disregard (?:all )?(?:the )?(?:rules|guidelines|boundaries|system prompt)/i },
  { id: "system_override", re: /(?:you are now|act as|pretend to be)\s+(?:a |an )?(?:different|new|unrestricted|developer|admin)/i },
  { id: "reveal_system", re: /(?:reveal|print|repeat|show)\s+(?:your |the )?(?:system|hidden|developer)\s+(?:prompt|instructions)/i },
  { id: "exfiltrate", re: /(?:send|post|upload|exfiltrate|leak)\s+(?:this|the|all)?\s*(?:data|context|secrets?|credentials?)/i },
  { id: "tool_injection", re: /<\/?(?:tool_call|function_call|system|assistant)\b/i },
  { id: "cn_ignore_previous", re: /忽略(?:之前|上面|以上|前面)(?:所有)?(?:的)?(?:指令|提示|规则)/ },
  { id: "cn_override", re: /(?:现在|从现在起)你(?:是|要扮演|将扮演)/ },
  { id: "cn_reveal", re: /(?:显示|打印|输出|泄露)(?:你的|系统)?(?:系统提示|隐藏指令|提示词)/ },
];

export type PromptInjectionScanInput = {
  /** Concatenated, already-selected context text to scan. */
  text: string;
};

/**
 * Run the reference prompt-injection scan over context text. Returns a
 * `passed` / `failed` result (never `skipped` — skipping is a receipt-author
 * decision recorded for synthetic fixtures only, not a scanner output).
 */
export function scanContextForPromptInjection(
  input: PromptInjectionScanInput,
): PromptInjectionScanResult {
  const hitPatternIds = PROMPT_INJECTION_PATTERNS.filter(({ re }) => re.test(input.text)).map(
    ({ id }) => id,
  );
  return promptInjectionScanResultSchema.parse({
    status: hitPatternIds.length > 0 ? "failed" : "passed",
    hitPatternIds,
  });
}
