function enumFallback(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function riskTone(level: string): "neutral" | "info" | "warning" | "danger" {
  switch (level) {
    case "LOW":
      return "neutral";
    case "MEDIUM":
      return "info";
    case "HIGH":
      return "warning";
    case "CRITICAL":
      return "danger";
    default:
      return "neutral";
  }
}

export function riskLabel(level: string, english: boolean): string {
  if (english) {
    switch (level) {
      case "LOW":
      case "低":
        return "Low";
      case "MEDIUM":
      case "中":
        return "Medium";
      case "HIGH":
      case "高":
        return "High";
      case "CRITICAL":
      case "极高":
        return "Critical";
      default:
        return enumFallback(level);
    }
  }

  switch (level) {
    case "LOW":
      return "低";
    case "MEDIUM":
      return "中";
    case "HIGH":
      return "高";
    case "CRITICAL":
      return "极高";
    default:
      return level;
  }
}

export function stageLabel(stage: string, english: boolean): string {
  if (english) {
    switch (stage) {
      case "CONTACTED":
      case "已接触":
        return "Contacted";
      case "ADVANCING":
      case "推进中":
        return "Advancing";
      case "WAITING_THEM":
      case "等对方":
        return "Waiting on customer";
      case "INTERNAL_SYNC":
      case "内部同步":
        return "Internal sync";
      default:
        return enumFallback(stage);
    }
  }

  switch (stage) {
    case "CONTACTED":
      return "已接触";
    case "ADVANCING":
      return "推进中";
    case "WAITING_THEM":
      return "等对方";
    case "INTERNAL_SYNC":
      return "内部同步";
    default:
      return stage;
  }
}
