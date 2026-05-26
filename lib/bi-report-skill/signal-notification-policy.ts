export function isBiReportSignalNotificationSendEnabled() {
  const legacyTenantEnv = ["GUANG", "PU_BI_SIGNAL_NOTIFICATION_SEND_ENABLED"].join("");
  return (
    process.env.BI_REPORT_SIGNAL_NOTIFICATION_SEND_ENABLED?.trim().toLowerCase() === "true" ||
    process.env[legacyTenantEnv]?.trim().toLowerCase() === "true"
  );
}
