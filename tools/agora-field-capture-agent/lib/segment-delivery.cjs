"use strict";

const DEFAULT_RETRY_DELAYS_MS = [250, 750, 2000, 5000];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BoundedSegmentDelivery {
  constructor({
    deliver,
    maxQueued = 500,
    batchSize = 20,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    waitImpl = wait,
    onState = () => {},
  }) {
    if (typeof deliver !== "function") throw new Error("Segment deliver function is required");
    this.deliver = deliver;
    this.maxQueued = maxQueued;
    this.batchSize = batchSize;
    this.retryDelaysMs = retryDelaysMs;
    this.waitImpl = waitImpl;
    this.onState = onState;
    this.queue = [];
    this.seen = new Set();
    this.seenOrder = [];
    this.worker = null;
    this.failure = null;
    this.closed = false;
  }

  enqueue(segment) {
    if (this.closed) return false;
    const key = `${segment.sourceUid}:${segment.sentenceId}`;
    if (this.seen.has(key)) return false;
    if (this.queue.length >= this.maxQueued) {
      this.failure = new Error("Final transcript queue reached its bounded limit");
      this.onState({ state: "DEGRADED", pending: this.queue.length, error: this.failure.message });
      return false;
    }

    this.seen.add(key);
    this.seenOrder.push(key);
    if (this.seenOrder.length > 2000) {
      this.seen.delete(this.seenOrder.shift());
    }
    this.queue.push(segment);
    this.onState({ state: "QUEUED", pending: this.queue.length });
    this.startWorker();
    return true;
  }

  startWorker() {
    if (this.worker || this.failure || this.closed) return;
    this.worker = this.drain().finally(() => {
      this.worker = null;
      if (this.queue.length && !this.failure && !this.closed) this.startWorker();
    });
  }

  async drain() {
    while (this.queue.length && !this.closed) {
      const batch = this.queue.slice(0, this.batchSize);
      let delivered = false;
      let lastError = null;
      for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
        try {
          await this.deliver(batch);
          delivered = true;
          break;
        } catch (error) {
          lastError = error;
          if (!error?.retryable || attempt === this.retryDelaysMs.length) break;
          await this.waitImpl(this.retryDelaysMs[attempt]);
        }
      }
      if (!delivered) {
        this.failure = lastError || new Error("Final transcript delivery failed");
        this.onState({
          state: "DEGRADED",
          pending: this.queue.length,
          error: this.failure.message,
        });
        return;
      }
      this.queue.splice(0, batch.length);
      this.onState({ state: "DELIVERED", pending: this.queue.length });
    }
  }

  async flush(timeoutMs = 10_000) {
    this.startWorker();
    const deadline = Date.now() + timeoutMs;
    while (this.worker && Date.now() < deadline) {
      await Promise.race([this.worker, this.waitImpl(25)]);
    }
    if (this.failure) throw this.failure;
    if (this.queue.length || this.worker) {
      throw new Error("Timed out while flushing final transcript segments");
    }
  }

  close() {
    this.closed = true;
    this.queue.length = 0;
    this.seen.clear();
    this.seenOrder.length = 0;
  }
}

module.exports = { BoundedSegmentDelivery, DEFAULT_RETRY_DELAYS_MS };
