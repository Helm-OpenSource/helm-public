type ConnectorWithOwner = {
  provider: string;
  user: { id: string };
};

export function pickConnectorForCurrentUser<
  TConnector extends ConnectorWithOwner,
>(
  connectors: TConnector[],
  input: {
    currentUserId: string;
    provider: TConnector["provider"];
  },
) {
  return (
    connectors.find(
      (connector) =>
        connector.provider === input.provider &&
        connector.user.id === input.currentUserId,
    ) as TConnector | undefined
  ) ?? null;
}
