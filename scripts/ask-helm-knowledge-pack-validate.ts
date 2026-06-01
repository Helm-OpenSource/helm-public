import {
  loadAskHelmKnowledgePack,
  validateAskHelmKnowledgePack,
} from "@/features/search/ask-helm-knowledge-pack";

const pack = loadAskHelmKnowledgePack({
  enabledTenantExtensions: ["bi-report", "customer-success"],
  enabledFeatures: ["custom_help:renewal"],
  disabledFeatures: ["settlement_help"],
  membershipRole: "owner",
  workspaceProfileType: "controlled_trial",
  focusAreas: ["renewal", "delivery"],
});
const validation = validateAskHelmKnowledgePack(pack);

console.log(
  JSON.stringify(
    {
      ...validation,
      featureAvailability: pack.featureAvailability,
      operations: Object.keys(pack.commonOperations).sort(),
    },
    null,
    2,
  ),
);

if (!validation.ok) {
  process.exit(1);
}
