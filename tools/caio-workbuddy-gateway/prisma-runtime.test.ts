import { describe, expect, it } from "vitest";

import {
  createPrismaWorkBuddyGatewayRuntime,
} from "./prisma-runtime";

const TEST_PRIVATE_IPV4 = [192, 168, 50, 20].join(".");

const enabledEnv = {
  CAIO_WORKBUDDY_GATEWAY_ENABLED: "true",
  CAIO_WORKBUDDY_READ_ENABLED: "true",
  CAIO_WORKBUDDY_PUSH_ENABLED: "true",
  CAIO_WORKBUDDY_PRESENCE_ENABLED: "true",
  CAIO_WORKBUDDY_MUTATIONS_ENABLED: "true",
  CAIO_WORKBUDDY_PROMPT_RESPONSES_ENABLED: "true",
  CAIO_WORKBUDDY_QUESTION_SELECTIONS_ENABLED: "true",
  CAIO_WORKBUDDY_ADVICE_DECISIONS_ENABLED: "true",
  CAIO_WORKBUDDY_GATEWAY_PROTOCOL: "https",
  CAIO_WORKBUDDY_GATEWAY_BIND_ADDRESS: TEST_PRIVATE_IPV4,
  CAIO_WORKBUDDY_GATEWAY_PORT: "9443",
  CAIO_WORKBUDDY_MTLS_CERT_PATH: "/private/etc/helm/server.crt",
  CAIO_WORKBUDDY_MTLS_KEY_PATH: "/private/etc/helm/server.key",
  CAIO_WORKBUDDY_MTLS_CA_PATH: "/private/etc/helm/client-ca.crt",
  CAIO_WORKBUDDY_MTLS_REQUIRE_CLIENT_CERT: "true",
} as const;

const verifiers = {
  presenceSignatureVerifier: {
    verify: async () => true,
  },
  mutationProofVerifier: {
    verify: async () => true,
  },
} as const;

describe("createPrismaWorkBuddyGatewayRuntime", () => {
  it("composes all existing read, delivery, and governed mutation tools", () => {
    const runtime = createPrismaWorkBuddyGatewayRuntime({
      env: enabledEnv,
      ...verifiers,
      now: () => "2026-07-26T00:00:00.000Z",
    });

    expect(runtime.dispatcher.listTools().map((tool) => tool.name)).toEqual([
      "begin_owner_presence_challenge",
      "complete_owner_presence_challenge",
      "get_p1c_read_projection",
      "poll_ceo_prompts",
      "list_pending_ceo_prompts",
      "get_ceo_prompt",
      "prepare_prompt_response",
      "submit_prompt_response",
      "get_prompt_response_receipt",
      "prepare_question_selection",
      "submit_question_selection",
      "get_question_selection_receipt",
      "prepare_advice_decision",
      "submit_advice_decision",
      "get_advice_decision_receipt",
    ]);
    expect(runtime).toMatchObject({
      transportBoundary: "external-mtls-adapter-required",
      persistenceBoundary: "prisma-transport-ledger",
      canonicalObjectOwnership: "existing-services-only",
      deliveryIngressExposed: false,
    });
    expect(runtime).not.toHaveProperty("delivery");
  });

  it("keeps the fully composed runtime dark by default", () => {
    const runtime = createPrismaWorkBuddyGatewayRuntime({
      env: {},
      ...verifiers,
    });

    expect(runtime.config.enabled).toBe(false);
    expect(runtime.dispatcher.listTools()).toEqual([]);
  });
});
