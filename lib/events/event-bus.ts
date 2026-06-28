/**
 * lib/events/event-bus.ts — Helm AgentOS event bus (Tier 1.3).
 *
 * The AgentOS review (P-B) found Helm has no event/message bus: components talk via
 * synchronous function calls + a passive audit seam, so there is no async coordination,
 * no event-driven promotion, no cross-instance fan-out. This is the in-process event
 * bus primitive + a registration seam so a host can swap a durable/distributed
 * implementation. PURELY ADDITIVE — no existing Core code calls it; behavior unchanged
 * until something publishes/subscribes.
 *
 * Safety rails consistent with the rest of Helm: deterministic eventId (no UUID / no ms
 * timestamp), reference-only payloads (no PII / no raw values — carry a payloadRef),
 * workspace-scoped, fail-soft delivery (one handler throwing never blocks the others or
 * the publisher; failures are collected, not swallowed silently).
 */

export type HelmEvent = Readonly<{
  /** Deterministic id: evt:<topic>:<workspaceId>:<dedupeKey>. No UUID / no ms timestamp. */
  eventId: string;
  workspaceId: string;
  topic: string;
  /** Reference to the business window/date the event belongs to (not a wall clock). */
  occurredAtRef: string;
  /** Reference to the payload (no PII / no raw values inline). */
  payloadRef: string;
  /** Optional audit correlation id (matches the audit trace context). */
  traceId?: string | null;
}>;

export type HelmEventHandler = (event: HelmEvent) => void | Promise<void>;

export interface EventBus {
  publish(event: HelmEvent): Promise<HelmEventPublishResult>;
  subscribe(topic: string, handler: HelmEventHandler): () => void;
}

export type HelmEventPublishResult = Readonly<{
  eventId: string;
  delivered: number;
  /** Handlers that threw — collected, never silently swallowed. */
  failures: ReadonlyArray<{ topic: string; error: string }>;
}>;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MS_TIMESTAMP_RE = /\b\d{13,}\b/;

/** Deterministic event id; rejects UUID / ms timestamp / empty parts. */
export function buildHelmEventId(input: {
  topic: string;
  workspaceId: string;
  dedupeKey: string;
}): string {
  for (const [name, value] of Object.entries(input)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`helm event id requires a non-empty ${name}`);
    }
    if (UUID_RE.test(value)) throw new Error(`helm event ${name} must not contain a UUID`);
    if (MS_TIMESTAMP_RE.test(value)) throw new Error(`helm event ${name} must not contain a ms timestamp`);
  }
  return `evt:${input.topic}:${input.workspaceId}:${input.dedupeKey}`;
}

/** Fail-closed structural validation of an event. */
export function validateHelmEvent(event: HelmEvent): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];
  for (const key of ["eventId", "workspaceId", "topic", "occurredAtRef", "payloadRef"] as const) {
    if (typeof event?.[key] !== "string" || event[key].trim() === "") blockers.push(`${key}_required`);
  }
  if (typeof event?.eventId === "string" && (UUID_RE.test(event.eventId) || MS_TIMESTAMP_RE.test(event.eventId))) {
    blockers.push("event_id_not_deterministic");
  }
  if (typeof event?.payloadRef === "string" && /\s/.test(event.payloadRef)) {
    // payloadRef must be a reference token, not free-form inline content (no PII inline).
    blockers.push("payload_ref_must_be_a_reference_not_inline_content");
  }
  return { ok: blockers.length === 0, blockers };
}

/**
 * In-process event bus. Subscribers are per-topic; publish delivers to all subscribers
 * of the event's topic. A throwing handler is isolated (collected into failures), so one
 * bad subscriber never blocks the rest or the publisher.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<HelmEventHandler>>();

  subscribe(topic: string, handler: HelmEventHandler): () => void {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    const set = this.handlers.get(topic)!;
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(topic);
    };
  }

  async publish(event: HelmEvent): Promise<HelmEventPublishResult> {
    const { ok, blockers } = validateHelmEvent(event);
    if (!ok) throw new Error(`helm event invalid: ${blockers.join(",")}`);
    const set = this.handlers.get(event.topic);
    const failures: { topic: string; error: string }[] = [];
    let delivered = 0;
    for (const handler of set ? [...set] : []) {
      try {
        await handler(event);
        delivered += 1;
      } catch (error) {
        failures.push({ topic: event.topic, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return Object.freeze({ eventId: event.eventId, delivered, failures: Object.freeze(failures) });
  }
}

// --- registration seam: host can swap a durable/distributed bus -----------------

let activeBus: EventBus = new InMemoryEventBus();

export function registerEventBus(bus: EventBus): EventBus {
  const previous = activeBus;
  activeBus = bus;
  return previous;
}

export function getEventBus(): EventBus {
  return activeBus;
}

export function resetEventBusForTest(): void {
  activeBus = new InMemoryEventBus();
}
