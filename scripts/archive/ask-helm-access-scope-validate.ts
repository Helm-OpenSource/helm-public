import { resolveAskHelmAccessScope } from "@/features/search/ask-helm-access-scope";

const memberScope = resolveAskHelmAccessScope({
  hasWorkspaceMembership: true,
  membershipRole: "member",
  enabledTenantExtensions: ["bi-report"],
  requestedHelpTopics: ["memory", "reserved_internal_truth", "settlement"],
});
const noMembershipScope = resolveAskHelmAccessScope({
  hasWorkspaceMembership: false,
  requestedHelpTopics: ["memory"],
});
const failures = [
  memberScope.canAsk ? null : "member scope should be allowed",
  memberScope.objectReadScope === "current_workspace"
    ? null
    : "member object read scope should be current_workspace",
  memberScope.deniedHelpTopics.includes("reserved_internal_truth")
    ? null
    : "reserved_internal_truth should be denied",
  memberScope.retrievalSourcePolicy.officialWritePath === "denied"
    ? null
    : "official write path should stay denied",
  noMembershipScope.canAsk ? "non-member scope should be denied" : null,
  noMembershipScope.retrievalSourcePolicy.objectSearch === "denied"
    ? null
    : "non-member object search should be denied",
].filter((failure): failure is string => Boolean(failure));

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      failures,
      memberScope,
      noMembershipScope,
    },
    null,
    2,
  ),
);

if (failures.length) {
  process.exit(1);
}
