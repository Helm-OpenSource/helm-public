export type ConnectorSignalClassification = {
  provider: "DINGTALK_MCP";
  channel: "external_connector";
  sourceFamily: "work_report" | "calendar_event" | "todo_task" | "project_item" | "management_signal" | "message_notification" | "unknown";
  businessDomain: "execution" | "meeting" | "task" | "project" | "management" | "notification" | "unknown";
  flowModule: "opportunity" | "meeting" | "memory" | "approval" | "operating";
};

export function classifyDingTalkSignal(input: {
  scope: string;
  sourceType: string;
}): ConnectorSignalClassification {
  const scope = input.scope.toUpperCase();
  const sourceType = input.sourceType.toLowerCase();

  if (scope === "WORK" || sourceType.includes("report")) {
    return {
      provider: "DINGTALK_MCP",
      channel: "external_connector",
      sourceFamily: "work_report",
      businessDomain: "execution",
      flowModule: "opportunity",
    };
  }
  if (scope === "CALENDAR" || scope === "MEETINGS") {
    return {
      provider: "DINGTALK_MCP",
      channel: "external_connector",
      sourceFamily: "calendar_event",
      businessDomain: "meeting",
      flowModule: "meeting",
    };
  }
  if (scope === "TODO") {
    return {
      provider: "DINGTALK_MCP",
      channel: "external_connector",
      sourceFamily: "todo_task",
      businessDomain: "task",
      flowModule: "opportunity",
    };
  }
  if (scope === "PROJECTS") {
    return {
      provider: "DINGTALK_MCP",
      channel: "external_connector",
      sourceFamily: "project_item",
      businessDomain: "project",
      flowModule: "opportunity",
    };
  }
  if (scope === "MANAGEMENT") {
    return {
      provider: "DINGTALK_MCP",
      channel: "external_connector",
      sourceFamily: "management_signal",
      businessDomain: "management",
      flowModule: "operating",
    };
  }
  if (scope === "MESSAGE_NOTIFICATIONS") {
    return {
      provider: "DINGTALK_MCP",
      channel: "external_connector",
      sourceFamily: "message_notification",
      businessDomain: "notification",
      flowModule: "operating",
    };
  }

  return {
    provider: "DINGTALK_MCP",
    channel: "external_connector",
    sourceFamily: "unknown",
    businessDomain: "unknown",
    flowModule: "memory",
  };
}
