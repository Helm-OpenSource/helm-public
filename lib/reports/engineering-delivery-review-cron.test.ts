import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startEngineeringDeliveryReviewCron } from "@/lib/reports/engineering-delivery-review-cron";

const ENV_KEYS = [
  "NODE_ENV",
  "ENGINEERING_REVIEW_CRON_ENABLED",
  "HELM_SIGNAL_RUNTIME_WRITES_ENABLED",
] as const;

const savedEnv: Record<string, string | undefined> = {};

describe("engineering delivery review cron deployment controls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NODE_ENV = "production";
    delete global.__engineeringDeliveryReviewCronState;
  });

  afterEach(() => {
    const timer = global.__engineeringDeliveryReviewCronState?.timer;
    if (timer) clearTimeout(timer);
    delete global.__engineeringDeliveryReviewCronState;
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    vi.useRealTimers();
  });

  it("does not register when the local cron control is false", () => {
    process.env.ENGINEERING_REVIEW_CRON_ENABLED = "false";

    startEngineeringDeliveryReviewCron();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not bind engineering cron to the signal runtime gate", () => {
    process.env.ENGINEERING_REVIEW_CRON_ENABLED = "true";
    process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = "false";

    startEngineeringDeliveryReviewCron();

    expect(vi.getTimerCount()).toBe(1);
  });

  it("treats an invalid local cron control as disabled", () => {
    process.env.ENGINEERING_REVIEW_CRON_ENABLED = "yes";

    startEngineeringDeliveryReviewCron();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves the legacy default when deployment controls are absent", () => {
    startEngineeringDeliveryReviewCron();

    expect(vi.getTimerCount()).toBe(1);
  });
});
