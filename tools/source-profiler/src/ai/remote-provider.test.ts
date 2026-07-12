import { describe, it, expect } from "vitest";
import { createRemoteProvider } from "./remote-provider";
import { AiProviderResponseError } from "./types";

describe("createRemoteProvider", () => {
  it("parses a fully well-formed suggestion batch", async () => {
    const transport = async () =>
      JSON.stringify([
        { sourceObjectId: "o1", targetEntity: "Opportunity", signalFamily: "advancement", reasoning: "ok", confidence: 80 },
        { sourceObjectId: "o3", targetEntity: "Contact", signalFamily: "advancement", reasoning: "ok", confidence: 50 },
      ]);
    const provider = createRemoteProvider({ kind: "custom", transport });
    const out = await provider.suggest({ instruction: "x", redactedPacketJson: "{}" });
    expect(out.map((s) => s.sourceObjectId)).toEqual(["o1", "o3"]);
    expect(out[0].confidence).toBe(80);
  });

  it("fails the whole batch closed on non-JSON transport output", async () => {
    const provider = createRemoteProvider({ kind: "custom", transport: async () => "not json" });
    await expect(
      provider.suggest({ instruction: "x", redactedPacketJson: "{}" }),
    ).rejects.toMatchObject<Partial<AiProviderResponseError>>({ failure: "parse_failure" });
  });

  it.each([
    {
      label: "mixed valid and invalid items",
      payload: [
        {
          sourceObjectId: "o1",
          targetEntity: "Opportunity",
          signalFamily: "advancement",
          reasoning: "ok",
          confidence: 80,
        },
        {
          sourceObjectId: "o2",
          targetEntity: "NotAnEntity",
          signalFamily: "advancement",
          reasoning: "bad",
          confidence: 70,
        },
      ],
    },
    {
      label: "extra side-effect field",
      payload: [
        {
          sourceObjectId: "o1",
          targetEntity: "Opportunity",
          signalFamily: "advancement",
          reasoning: "ok",
          confidence: 80,
          activateConnector: true,
        },
      ],
    },
    {
      label: "coerced confidence",
      payload: [
        {
          sourceObjectId: "o1",
          targetEntity: "Opportunity",
          signalFamily: "advancement",
          reasoning: "ok",
          confidence: "80",
        },
      ],
    },
  ])("fails the whole batch closed on $label", async ({ payload }) => {
    const provider = createRemoteProvider({
      kind: "custom",
      transport: async () => JSON.stringify(payload),
    });
    await expect(
      provider.suggest({ instruction: "x", redactedPacketJson: "{}" }),
    ).rejects.toMatchObject<Partial<AiProviderResponseError>>({ failure: "schema_failure" });
  });
});
