import { runLightChainFollowThroughSweep } from "@/lib/task-follow-through/light-chain-follow-through-sweep.service";

// Daily advice-only follow-through sweep for the light task chain, following
// the engineering-delivery-review cron pattern: opt-in via env flag, single
// global timer, safe to call repeatedly. Default OFF — enabling active
// reminders is a workspace-operations decision, not a code default.

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000;

type CronRuntimeState = {
  started: boolean;
  timer: NodeJS.Timeout | null;
};

declare global {
  var __lightChainFollowThroughCronState: CronRuntimeState | undefined;
}

function isCronEnabled(rawValue: string | undefined): boolean {
  return rawValue === "true" || rawValue === "1";
}

async function runSweepSafely() {
  try {
    const results = await runLightChainFollowThroughSweep();
    const totalFindings = results.reduce((sum, result) => sum + result.findings.length, 0);
    console.info(
      `[light-chain-follow-through] sweep complete: ${results.length} workspaces, ${totalFindings} findings`,
    );
  } catch (error) {
    console.error(
      "[light-chain-follow-through] sweep failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function startLightChainFollowThroughCron() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (!isCronEnabled(process.env.LIGHT_CHAIN_FOLLOW_THROUGH_CRON_ENABLED)) {
    return;
  }

  const state = (global.__lightChainFollowThroughCronState ??= {
    started: false,
    timer: null,
  });

  if (state.started) {
    return;
  }

  state.started = true;
  state.timer = setTimeout(() => {
    void runSweepSafely();
    state.timer = setInterval(() => {
      void runSweepSafely();
    }, SWEEP_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
