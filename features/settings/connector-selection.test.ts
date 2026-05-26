import { describe, expect, it } from "vitest";
import { pickConnectorForCurrentUser } from "@/features/settings/connector-selection";

type ConnectorFixture = {
  id: string;
  provider: "GMAIL" | "DINGTALK" | "WECOM";
  user: { id: string; name: string; email: string };
};

describe("pickConnectorForCurrentUser", () => {
  const connectors: ConnectorFixture[] = [
    {
      id: "conn_owner",
      provider: "GMAIL",
      user: { id: "user_owner", name: "Owner", email: "owner@example.com" },
    },
    {
      id: "conn_colleague",
      provider: "GMAIL",
      user: { id: "user_colleague", name: "Colleague", email: "colleague@example.com" },
    },
    {
      id: "conn_dingtalk",
      provider: "DINGTALK",
      user: { id: "user_colleague", name: "Colleague", email: "colleague@example.com" },
    },
  ];

  it("returns only the connector owned by the active user", () => {
    const connector = pickConnectorForCurrentUser(connectors, {
      currentUserId: "user_colleague",
      provider: "GMAIL",
    });

    expect(connector?.id).toBe("conn_colleague");
  });

  it("does not leak another member's connector when the active user has no connector", () => {
    const connector = pickConnectorForCurrentUser(connectors, {
      currentUserId: "user_owner",
      provider: "WECOM",
    });

    expect(connector).toBeNull();
  });
});
