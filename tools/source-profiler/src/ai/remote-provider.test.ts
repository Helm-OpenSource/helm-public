import { describe, it, expect } from "vitest";
import { createRemoteProvider } from "./remote-provider";

describe("createRemoteProvider", () => {
  it("parses well-formed suggestions and drops invalid ones", async () => {
    const transport = async () =>
      JSON.stringify([
        { sourceObjectId: "o1", targetEntity: "Opportunity", signalFamily: "advancement", reasoning: "ok", confidence: 200 },
        { sourceObjectId: "o2", targetEntity: "NotAnEntity", signalFamily: "advancement", reasoning: "bad" },
        { sourceObjectId: "o3", targetEntity: "Contact", signalFamily: "advancement", reasoning: "ok", confidence: 50 },
      ]);
    const provider = createRemoteProvider({ kind: "custom", transport });
    const out = await provider.suggest({ instruction: "x", redactedPacketJson: "{}" });
    expect(out.map((s) => s.sourceObjectId)).toEqual(["o1", "o3"]);
    // confidence clamped to 0-100
    expect(out[0].confidence).toBe(100);
  });

  it("returns [] on non-JSON transport output", async () => {
    const provider = createRemoteProvider({ kind: "custom", transport: async () => "not json" });
    expect(await provider.suggest({ instruction: "x", redactedPacketJson: "{}" })).toEqual([]);
  });
});
