import { describe, expect, it } from "vitest";

import {
  buildHelmEventId,
  InMemoryEventBus,
  validateHelmEvent,
  type EventBus,
  type HelmEvent,
} from "./event-bus";
import { InMemoryOutboxStore, relayOutbox } from "./outbox";

function ev(over: Partial<HelmEvent> = {}): HelmEvent {
  return {
    eventId: buildHelmEventId({ topic: "worker.observed", workspaceId: "ws-1", dedupeKey: "case-1:w1" }),
    workspaceId: "ws-1",
    topic: "worker.observed",
    occurredAtRef: "window:2026-W26",
    payloadRef: "obs:case-1:w1",
    ...over,
  };
}

describe("helm event id", () => {
  it("is deterministic and rejects UUID / ms timestamp / empty parts", () => {
    expect(buildHelmEventId({ topic: "t", workspaceId: "ws", dedupeKey: "k" })).toBe("evt:t:ws:k");
    expect(() => buildHelmEventId({ topic: "t", workspaceId: "ws", dedupeKey: "" })).toThrow(/non-empty/);
    expect(() => buildHelmEventId({ topic: "t", workspaceId: "11111111-2222-3333-4444-555555555555", dedupeKey: "k" })).toThrow(/UUID/);
    expect(() => buildHelmEventId({ topic: "t", workspaceId: "ws", dedupeKey: "1700000000000" })).toThrow(/ms timestamp/);
  });
});

describe("validateHelmEvent", () => {
  it("fail-closed on missing fields, non-deterministic id, inline payload", () => {
    expect(validateHelmEvent(ev()).ok).toBe(true);
    expect(validateHelmEvent({ ...ev(), workspaceId: "" }).ok).toBe(false);
    expect(validateHelmEvent({ ...ev(), eventId: "abcdabcd-1111-2222-3333-444455556666" }).blockers).toContain("event_id_not_deterministic");
    expect(validateHelmEvent({ ...ev(), payloadRef: "raw debtor name here" }).blockers).toContain(
      "payload_ref_must_be_a_reference_not_inline_content",
    );
  });
});

describe("InMemoryEventBus", () => {
  it("delivers to all topic subscribers; unsubscribe stops delivery", async () => {
    const bus = new InMemoryEventBus();
    const got: string[] = [];
    const off1 = bus.subscribe("worker.observed", (e) => void got.push(`a:${e.eventId}`));
    bus.subscribe("worker.observed", (e) => void got.push(`b:${e.eventId}`));
    const r1 = await bus.publish(ev());
    expect(r1.delivered).toBe(2);
    expect(got).toHaveLength(2);
    off1();
    const r2 = await bus.publish(ev());
    expect(r2.delivered).toBe(1); // only b remains
  });

  it("isolates a throwing handler — others still deliver, failures collected", async () => {
    const bus = new InMemoryEventBus();
    let okCalls = 0;
    bus.subscribe("t", () => {
      throw new Error("boom");
    });
    bus.subscribe("t", () => void (okCalls += 1));
    const r = await bus.publish(ev({ topic: "t", eventId: "evt:t:ws-1:k" }));
    expect(okCalls).toBe(1);
    expect(r.delivered).toBe(1);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].error).toMatch(/boom/);
  });

  it("rejects publishing an invalid event", async () => {
    const bus = new InMemoryEventBus();
    await expect(bus.publish({ ...ev(), payloadRef: "" })).rejects.toThrow(/invalid/);
  });
});

describe("transactional outbox", () => {
  it("enqueue is idempotent; markPublished removes from pending", async () => {
    const store = new InMemoryOutboxStore();
    await store.enqueue(ev());
    await store.enqueue(ev()); // same eventId — idempotent
    expect(await store.listPending()).toHaveLength(1);
    await store.markPublished({ workspaceId: "ws-1", eventId: ev().eventId });
    expect(await store.listPending()).toHaveLength(0);
    await store.markPublished({ workspaceId: "ws-1", eventId: ev().eventId }); // idempotent re-mark
    expect(await store.listPending()).toHaveLength(0);
  });

  it("relay publishes pending to the bus then marks published; re-relay does not re-publish", async () => {
    const store = new InMemoryOutboxStore();
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe("worker.observed", (e) => void seen.push(e.eventId));
    await store.enqueue(ev());
    const r1 = await relayOutbox(store, bus);
    expect(r1.published).toBe(1);
    expect(seen).toEqual([ev().eventId]);
    const r2 = await relayOutbox(store, bus); // nothing pending now
    expect(r2.published).toBe(0);
    expect(seen).toHaveLength(1); // not re-published
  });

  it("at-least-once: a failing publish leaves the event pending for the next relay", async () => {
    const store = new InMemoryOutboxStore();
    const throwingBus: EventBus = { async publish() { throw new Error("bus down"); }, subscribe: () => () => {} };
    await store.enqueue(ev());
    const r1 = await relayOutbox(store, throwingBus);
    expect(r1.published).toBe(0);
    expect(r1.retained).toHaveLength(1);
    expect(await store.listPending()).toHaveLength(1); // still pending
    // bus recovers → next relay delivers
    const okBus = new InMemoryEventBus();
    const seen: string[] = [];
    okBus.subscribe("worker.observed", (e) => void seen.push(e.eventId));
    const r2 = await relayOutbox(store, okBus);
    expect(r2.published).toBe(1);
    expect(seen).toEqual([ev().eventId]);
  });

  it("scopes pending by workspace + preserves enqueue order", async () => {
    const store = new InMemoryOutboxStore();
    await store.enqueue(ev({ eventId: "evt:t:ws-1:a", topic: "t", payloadRef: "p:a" }));
    await store.enqueue(ev({ workspaceId: "ws-2", eventId: "evt:t:ws-2:b", topic: "t", payloadRef: "p:b" }));
    await store.enqueue(ev({ eventId: "evt:t:ws-1:c", topic: "t", payloadRef: "p:c" }));
    const ws1 = await store.listPending({ workspaceId: "ws-1" });
    expect(ws1.map((e) => e.eventId)).toEqual(["evt:t:ws-1:a", "evt:t:ws-1:c"]); // order preserved, ws-2 excluded
  });
});
