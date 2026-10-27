// Next evaluates the instrumentation entry in both runtimes. Keep the Node
// composition root out of the Edge dependency graph.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.info(`[instrumentation] skip server cron registration ${JSON.stringify({
      nextRuntime: process.env.NEXT_RUNTIME ?? null,
    })}`);
    return;
  }

  const { registerNodeInstrumentation } = await import("@/lib/runtime/node-instrumentation");
  await registerNodeInstrumentation();
}
