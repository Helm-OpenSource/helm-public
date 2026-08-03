export function hasJsonContentType(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  return mediaType === "application/json";
}

export function hasRequestPayload(request: Request) {
  const contentLength = request.headers.get("content-length")?.trim();
  if (contentLength && contentLength !== "0") return true;
  if (request.headers.has("transfer-encoding")) return true;
  return request.body !== null;
}
