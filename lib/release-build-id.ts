const RELEASE_BUILD_ID_RE = /^helm-release-[a-f0-9]{40}$/u;

export function resolveReleaseBuildId(
  configured: string | undefined,
): string | undefined {
  if (configured === undefined) return undefined;
  if (!RELEASE_BUILD_ID_RE.test(configured)) {
    throw new Error(
      "HELM_RELEASE_BUILD_ID must be helm-release- followed by one lowercase 40-character commit SHA",
    );
  }
  return configured;
}
