/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CaioAttentionActionState } from "./command-form";

const submitted: FormData[] = [];
const result = vi.hoisted(() => ({ next: { status: "ok" } as CaioAttentionActionState }));
vi.mock("./actions", () => ({
  runCaioAttentionCommandAction: async (_previous: CaioAttentionActionState, formData: FormData) => {
    submitted.push(formData);
    return result.next;
  },
}));

const { CaioAttentionOperationForm, newCaioAttentionRequestId } = await import("./case-forms.client");
const common = { caseId: "c1", commandVersion: 1, english: true };
const requestIds = () => submitted.map((data) => data.get("clientRequestId"));

async function click(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name })); });
}

describe("attention form request ids", () => {
  beforeEach(() => { submitted.length = 0; result.next = { status: "ok" }; });

  it("gives each form on the page its own id, keeps it for a retry and replaces it after a success", async () => {
    render(
      <>
        <CaioAttentionOperationForm common={common} kind="ack" />
        <CaioAttentionOperationForm common={common} kind="note" />
      </>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "checked the queue" } });
    result.next = { status: "error", reason: "conflict" };
    await click("Acknowledge");
    await click("Acknowledge");
    result.next = { status: "ok" };
    await click("Submit note");
    await click("Acknowledge");
    await click("Acknowledge");

    const [ackFailed, ackRetry, note, ackOk, ackNext] = requestIds();
    for (const id of requestIds()) expect(id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(ackRetry).toBe(ackFailed);
    expect(note).not.toBe(ackFailed);
    expect(ackOk).toBe(ackFailed);
    expect(ackNext).not.toBe(ackOk);
    expect(submitted.map((data) => data.get("op"))).toEqual(["ack", "ack", "note", "ack", "ack"]);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("falls back to getRandomValues where randomUUID is missing (insecure context)", () => {
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    const first = newCaioAttentionRequestId();
    expect(first).toMatch(/^[0-9a-f]{32}$/u);
    expect(newCaioAttentionRequestId()).not.toBe(first);
  });
});
