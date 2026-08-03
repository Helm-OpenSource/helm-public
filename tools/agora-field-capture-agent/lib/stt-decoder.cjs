"use strict";

const protobuf = require("protobufjs");

function numericString(value) {
  const normalized = String(value ?? "0");
  return /^\d{1,20}$/.test(normalized) ? normalized : "0";
}

function createSttDecoder(protoPath) {
  const root = protobuf.loadSync(protoPath);
  const textType = root.lookupType("Agora.SpeechToText.Text");

  return {
    decode(data, options = {}) {
      const decoded = textType.decode(Buffer.from(data));
      const value = textType.toObject(decoded, {
        longs: String,
        defaults: false,
        arrays: true,
      });
      if (value.dataType && value.dataType !== "transcribe") return null;

      const words = Array.isArray(value.words) ? value.words : [];
      if (!words.length || words.some((word) => word.isFinal !== true)) return null;
      const text = words.map((word) => String(word.text || "")).join("").trim();
      if (!text) return null;

      const sourceUid = numericString(value.uid);
      const fallbackUid = numericString(options.fallbackSourceUid);
      const sentenceId = numericString(value.sentenceId);
      const textTsMs = numericString(value.textTs || value.time);
      if (sentenceId === "0" || textTsMs === "0") return null;

      return {
        sourceUid: sourceUid === "0" ? fallbackUid : sourceUid,
        sentenceId,
        text,
        textTsMs,
        durationMs: Math.max(0, Math.min(3_600_000, Number(value.durationMs) || 0)),
        language: String(value.culture || options.defaultLanguage || "zh-CN"),
        isFinal: true,
      };
    },
    type: textType,
  };
}

module.exports = { createSttDecoder };
