import { diffCaioAttentionPrefill } from "@/lib/caio-attention/routing";
import { isCaioAttentionTerminal, type CaioAttentionStatus } from "@/lib/caio-attention/state-machine";

import type { CaioAttentionCommandFields } from "./service-contract";

/** Pure helpers shared by the attention pages and forms; no IO, no clock. */

export const CAIO_ATTENTION_PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

/** `?page=` from the URL: anything that is not a positive integer reads as page 1. */
export function parseCaioAttentionPageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^[1-9][0-9]{0,4}$/u.test(value)) return 1;
  return Math.min(Number(value), MAX_PAGE);
}

export function caioAttentionPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Pending means still needs a human: every non-terminal status. */
export const isCaioAttentionPending = (status: CaioAttentionStatus) => !isCaioAttentionTerminal(status);

export type CaioAttentionCommandField = keyof CaioAttentionCommandFields;
export type CaioAttentionFieldChange = Readonly<{
  field: CaioAttentionCommandField;
  before: readonly string[];
  after: readonly string[];
}>;

const asList = (value: string | null | Date | readonly string[]): string[] => {
  if (value === null) return [];
  if (value instanceof Date) return [value.toISOString()];
  return typeof value === "string" ? [value] : [...value];
};

/**
 * What the OWNER changed relative to the system prefill, with before/after values for display. Which fields
 * changed comes from the S1 rule the service records on the confirm event, so page and event never disagree.
 */
export function diffCaioAttentionCommand(prefill: CaioAttentionCommandFields, edited: CaioAttentionCommandFields): CaioAttentionFieldChange[] {
  return (diffCaioAttentionPrefill(prefill, edited) as CaioAttentionCommandField[])
    .map((field) => ({ field, before: asList(prefill[field]), after: asList(edited[field]) }));
}
