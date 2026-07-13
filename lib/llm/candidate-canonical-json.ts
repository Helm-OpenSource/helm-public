export function serializeCandidateCanonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new TypeError("candidate canonical JSON does not allow undefined");
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new TypeError("candidate canonical JSON allows safe integers only");
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeCandidateCanonicalJson).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new TypeError("candidate canonical JSON contains an unsupported value");
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${serializeCandidateCanonicalJson(record[key])}`,
    )
    .join(",")}}`;
}
