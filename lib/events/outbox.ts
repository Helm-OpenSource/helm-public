/**
 * lib/events/outbox.ts — transactional outbox for the Helm event bus (Tier 1.3).
 *
 * The AgentOS review (P-B) flagged that partial failures leave inconsistent state: a
 * business write succeeds but the follow-on event is lost (no saga/outbox). The outbox
 * pattern fixes that: enqueue the event in the SAME transaction as the business write,
 * then a relay publishes pending events to the bus and marks them published. Crash
 * between publish and mark → re-published next relay (at-least-once); consumers dedupe
 * on the deterministic eventId.
 *
 * This is the contract + an in-memory reference implementation + a registration seam.
 * A durable (Prisma/MySQL) OutboxStore is the activation binding — same "rails now"
 * posture as the rest of the AgentOS work. PURELY ADDITIVE; no existing Core code uses it.
 */

import type { EventBus, HelmEvent } from "./event-bus";
import { getEventBus, validateHelmEvent } from "./event-bus";

export type OutboxRelayResult = Readonly<{
  published: number;
  /** Events that could not be published to the bus (left pending for the next relay). */
  retained: ReadonlyArray<{ eventId: string; error: string }>;
}>;

export interface OutboxStore {
  /** Enqueue an event. The CALLER is responsible for wrapping this in the business tx. Idempotent on eventId. */
  enqueue(event: HelmEvent): Promise<void>;
  listPending(input?: { workspaceId?: string }): Promise<HelmEvent[]>;
  markPublished(input: { workspaceId: string; eventId: string }): Promise<void>;
}

type StoredOutboxEntry = { event: HelmEvent; status: "pending" | "published"; seq: number };

/** In-memory reference store. Natural key = (workspaceId, eventId); enqueue is idempotent. */
export class InMemoryOutboxStore implements OutboxStore {
  private readonly entries = new Map<string, StoredOutboxEntry>();
  private seq = 0;

  private key(workspaceId: string, eventId: string): string {
    return `${workspaceId}::${eventId}`;
  }

  async enqueue(event: HelmEvent): Promise<void> {
    const { ok, blockers } = validateHelmEvent(event);
    if (!ok) throw new Error(`outbox enqueue rejected invalid event: ${blockers.join(",")}`);
    const k = this.key(event.workspaceId, event.eventId);
    if (this.entries.has(k)) return; // idempotent: same event never enqueued twice
    this.entries.set(k, { event, status: "pending", seq: this.seq++ });
  }

  async listPending(input?: { workspaceId?: string }): Promise<HelmEvent[]> {
    return [...this.entries.values()]
      .filter((e) => e.status === "pending" && (!input?.workspaceId || e.event.workspaceId === input.workspaceId))
      .sort((a, b) => a.seq - b.seq) // deterministic relay order = enqueue order
      .map((e) => e.event);
  }

  async markPublished(input: { workspaceId: string; eventId: string }): Promise<void> {
    const entry = this.entries.get(this.key(input.workspaceId, input.eventId));
    if (entry) entry.status = "published"; // idempotent: re-marking a published entry is a no-op
  }
}

/**
 * Relay pending outbox events to the bus, marking each published only after a successful
 * publish (at-least-once). A publish that throws leaves the event pending for retry.
 */
export async function relayOutbox(
  store: OutboxStore,
  bus: EventBus = getEventBus(),
  input?: { workspaceId?: string },
): Promise<OutboxRelayResult> {
  const pending = await store.listPending(input);
  const retained: { eventId: string; error: string }[] = [];
  let published = 0;
  for (const event of pending) {
    try {
      await bus.publish(event);
      await store.markPublished({ workspaceId: event.workspaceId, eventId: event.eventId });
      published += 1;
    } catch (error) {
      retained.push({ eventId: event.eventId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return Object.freeze({ published, retained: Object.freeze(retained) });
}

// --- registration seam: host can swap a durable (Prisma/MySQL) outbox store -----

let activeStore: OutboxStore = new InMemoryOutboxStore();

export function registerOutboxStore(store: OutboxStore): OutboxStore {
  const previous = activeStore;
  activeStore = store;
  return previous;
}

export function getOutboxStore(): OutboxStore {
  return activeStore;
}

export function resetOutboxStoreForTest(): void {
  activeStore = new InMemoryOutboxStore();
}
