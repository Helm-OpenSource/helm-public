"use strict";

const AGORA_UID_PATTERN = /^(?:[1-9]\d{0,9})$/;

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertLiveControlMaterial(result) {
  const rtc = result?.rtc;
  const expiresAt = Date.parse(rtc?.expiresAt || "");
  const valid =
    hasText(result?.providerSessionId) &&
    rtc?.mock === false &&
    hasText(rtc?.appId) &&
    hasText(rtc?.channelName) &&
    hasText(rtc?.publisherToken) &&
    AGORA_UID_PATTERN.test(String(rtc?.publisherUid || "")) &&
    AGORA_UID_PATTERN.test(String(rtc?.transcriptBotUid || "")) &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();

  if (!valid) {
    throw new Error("Helm returned non-live, expired, or incomplete RTC material");
  }
  if (String(rtc.publisherUid) === String(rtc.transcriptBotUid)) {
    throw new Error("Publisher and transcript bot UIDs must be distinct");
  }
  return result;
}

function mergeDeliveryFailure(result, error) {
  if (!error) return result;
  return {
    ...result,
    deliveryFailure: true,
    deliveryFailureMessage: String(error?.message || error || "Final transcript delivery failed")
      .slice(0, 300),
  };
}

module.exports = {
  AGORA_UID_PATTERN,
  assertLiveControlMaterial,
  mergeDeliveryFailure,
};
