import {
  createWorkBuddyMcpToolDispatcher,
  type WorkBuddyMcpToolDispatcher,
  type WorkBuddyToolDefinition,
} from "@/lib/caio-collaboration/mcp-tool-dispatcher";

import {
  loadWorkBuddyGatewayConfig,
  type WorkBuddyGatewayConfig,
} from "./config";

export type WorkBuddyGatewayRuntime = Readonly<{
  config: WorkBuddyGatewayConfig;
  dispatcher: WorkBuddyMcpToolDispatcher;
  transportBoundary: "external-mtls-adapter-required";
}>;

/**
 * Builds the public-safe protocol core only. A private deployment adapter must
 * terminate mTLS, derive client identity, and forward calls to the dispatcher.
 */
export function createWorkBuddyGatewayRuntime(input: {
  env: Readonly<Record<string, string | undefined>>;
  tools: readonly WorkBuddyToolDefinition[];
  now?: () => string;
}): WorkBuddyGatewayRuntime {
  const config = loadWorkBuddyGatewayConfig(input.env);
  return Object.freeze({
    config,
    dispatcher: createWorkBuddyMcpToolDispatcher({
      flags: config.featureFlags,
      tools: input.tools,
      now: input.now,
    }),
    transportBoundary: "external-mtls-adapter-required",
  });
}
