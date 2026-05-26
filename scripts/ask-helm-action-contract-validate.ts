import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";

const scenarios = [
  {
    id: "plan",
    rawQuery: "帮我把 Atlas 续约拆成三步",
    expectPlan: true,
    expectArtifact: false,
    expectHandoff: true,
    expectedBoundary: "suggestion_not_commitment",
  },
  {
    id: "draft",
    rawQuery: "准备一封给星河连锁的跟进邮件草稿",
    expectPlan: false,
    expectArtifact: true,
    expectHandoff: true,
    expectedBoundary: "draft_only",
  },
  {
    id: "review-packet",
    rawQuery: "准备这条机会的审批材料包",
    expectPlan: false,
    expectArtifact: true,
    expectHandoff: true,
    expectedBoundary: "review_required",
  },
  {
    id: "queue",
    rawQuery: "把这条加入内部跟进队列",
    expectPlan: false,
    expectArtifact: true,
    expectHandoff: true,
    expectedBoundary: "suggestion_not_commitment",
  },
  {
    id: "handoff",
    rawQuery: "把这件事交给客户成功负责人",
    expectPlan: false,
    expectArtifact: false,
    expectHandoff: true,
    expectedBoundary: "suggestion_not_commitment",
  },
  {
    id: "execution",
    rawQuery: "帮我安排执行这个计划",
    expectPlan: true,
    expectArtifact: false,
    expectHandoff: true,
    expectedBoundary: "review_required",
  },
  {
    id: "high-risk",
    rawQuery: "帮我直接给客户发续约邮件",
    expectPlan: true,
    expectArtifact: true,
    expectHandoff: true,
    expectedBoundary: "review_required",
  },
  {
    id: "open-domain",
    rawQuery: "Summarize Tesla's latest earnings",
    expectPlan: false,
    expectArtifact: false,
    expectHandoff: false,
    expectedBoundary: "out_of_scope",
  },
  {
    id: "cross-workspace",
    rawQuery: "跨两个 workspace 比较一下哪个团队效率更高",
    expectPlan: false,
    expectArtifact: false,
    expectHandoff: false,
    expectedBoundary: "cross_workspace_denied",
  },
];

function buildInterpreterInput(rawQuery: string) {
  const normalized = rawQuery.toLowerCase();

  if (normalized.includes("atlas")) {
    return {
      rawQuery,
      relatedObjects: [
        {
          objectType: "opportunity" as const,
          objectId: "opp_atlas",
          displayName: "Atlas AI 联合解决方案合作",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_atlas",
        },
      ],
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
        enabledTenantExtensions: ["bi-report"],
        focusAreas: ["renewal"],
      },
    };
  }

  if (normalized.includes("星河") || normalized.includes("xinghe")) {
    return {
      rawQuery,
      relatedObjects: [
        {
          objectType: "company" as const,
          objectId: "company_xinghe",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_xinghe",
        },
      ],
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
        enabledTenantExtensions: ["bi-report"],
        focusAreas: ["renewal"],
      },
    };
  }

  return {
    rawQuery,
    workspaceContext: {
      workspaceSlug: "demo",
      membershipRole: "member",
      enabledTenantExtensions: ["bi-report"],
      focusAreas: ["renewal"],
    },
  };
}

function validatePlanStructure(
  response: ReturnType<typeof interpretAskHelmQuery>,
  scenarioId: string,
) {
  if (!response.plan) {
    return [];
  }

  return response.plan.steps.flatMap((step) => {
    const failures: string[] = [];

    if (!step.objectRef?.label) {
      failures.push(`${scenarioId}:${step.id}: missing objectRef`);
    }
    if (!step.dri?.label || !step.dri.role) {
      failures.push(`${scenarioId}:${step.id}: missing dri`);
    }
    if (!step.due?.label || !step.due.timing) {
      failures.push(`${scenarioId}:${step.id}: missing due`);
    }

    return failures;
  });
}

const responses = scenarios.map((scenario) => ({
  scenario,
  response: interpretAskHelmQuery(buildInterpreterInput(scenario.rawQuery)),
}));

const failures = responses.flatMap(({ scenario, response }) => {
  const responseFailures: string[] = [];

  if (!response.retrievalPlan.readOnly || response.retrievalPlan.writePath) {
    responseFailures.push(`${scenario.id}: write path enabled`);
  }
  if (Boolean(response.plan) !== scenario.expectPlan) {
    responseFailures.push(`${scenario.id}: unexpected plan presence`);
  }
  if (Boolean(response.preparedArtifact) !== scenario.expectArtifact) {
    responseFailures.push(`${scenario.id}: unexpected artifact presence`);
  }
  if (Boolean(response.actionHandoff) !== scenario.expectHandoff) {
    responseFailures.push(`${scenario.id}: unexpected handoff presence`);
  }
  if (response.actionHandoff?.writeEnabled !== undefined) {
    if (response.actionHandoff.writeEnabled !== false) {
      responseFailures.push(`${scenario.id}: handoff write enabled`);
    }
  }
  if (response.boundaryNote?.type !== scenario.expectedBoundary) {
    responseFailures.push(
      `${scenario.id}: expected boundary ${scenario.expectedBoundary}, got ${response.boundaryNote?.type}`,
    );
  }
  if (!response.nextStep.primary.target) {
    responseFailures.push(`${scenario.id}: missing next step target`);
  }
  responseFailures.push(...validatePlanStructure(response, scenario.id));

  return responseFailures;
});

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      failures,
      cases: responses.map(({ scenario, response }) => ({
        id: scenario.id,
        intentType: response.classification.intentType,
        primaryTarget: response.classification.primaryTarget,
        boundaryType: response.boundaryNote?.type,
        hasPlan: Boolean(response.plan),
        hasPreparedArtifact: Boolean(response.preparedArtifact),
        hasActionHandoff: Boolean(response.actionHandoff),
        writePath: response.retrievalPlan.writePath,
        handoffWriteEnabled: response.actionHandoff?.writeEnabled,
      })),
    },
    null,
    2,
  ),
);

if (failures.length) {
  process.exit(1);
}
