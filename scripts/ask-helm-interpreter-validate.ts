import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";

const scenarios = [
  "找到和 Atlas 相关的机会",
  "今天最该先推进什么",
  "为什么这条还不能直接执行",
  "审批和经营记忆的区别是什么",
  "帮我直接给客户发续约邮件",
];

const responses = scenarios.map((rawQuery) =>
  interpretAskHelmQuery({
    rawQuery,
    workspaceContext: {
      workspaceSlug: "demo",
      membershipRole: "member",
      enabledTenantExtensions: ["bi-report"],
      focusAreas: ["renewal"],
    },
  }),
);
const failures = responses.flatMap((response) => {
  const responseFailures: string[] = [];
  if (!response.retrievalPlan.readOnly || response.retrievalPlan.writePath) {
    responseFailures.push(`${response.classification.intentType}: write path was enabled`);
  }
  if (!response.nextStep.primary.target) {
    responseFailures.push(`${response.classification.intentType}: missing primary target`);
  }
  if (
    response.classification.intentType === "out_of_scope" &&
    response.boundaryNote?.type !== "out_of_scope"
  ) {
    responseFailures.push("out_of_scope: missing boundary note");
  }
  return responseFailures;
});

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      totalScenarios: scenarios.length,
      supportedScenarios: responses.filter(
        (response) => response.classification.intentType !== "out_of_scope",
      ).length,
      failures,
      cases: responses.map((response) => ({
        query: response.classification.normalizedQuery,
        intentType: response.classification.intentType,
        sources: response.retrievalPlan.sources,
        nextStep: response.nextStep.primary,
        boundaryType: response.boundaryNote?.type,
      })),
    },
    null,
    2,
  ),
);

if (failures.length) {
  process.exit(1);
}
