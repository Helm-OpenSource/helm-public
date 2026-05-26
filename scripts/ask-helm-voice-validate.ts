import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";

const scenarios = [
  {
    id: "unconfirmed-transcript",
    rawQuery: "准备一封给星河连锁的跟进邮件草稿",
    transcriptConfirmed: false,
    voiceTranscriptConfidence: "medium" as const,
    requiresTranscriptConfirmation: true,
  },
  {
    id: "confirmed-high-confidence-transcript",
    rawQuery: "帮我把 Atlas 续约拆成三步",
    transcriptConfirmed: true,
    voiceTranscriptConfidence: "high" as const,
    requiresTranscriptConfirmation: false,
  },
  {
    id: "voice-high-risk-still-review-gated",
    rawQuery: "帮我直接给客户发续约邮件",
    transcriptConfirmed: true,
    voiceTranscriptConfidence: "high" as const,
    requiresTranscriptConfirmation: false,
    expectedBoundary: "review_required",
  },
];

const responses = scenarios.map((scenario) => ({
  scenario,
  response: interpretAskHelmQuery({
    rawQuery: scenario.rawQuery,
    inputMode: "voice",
    transcriptConfirmed: scenario.transcriptConfirmed,
    voiceTranscriptConfidence: scenario.voiceTranscriptConfidence,
    workspaceContext: {
      workspaceSlug: "demo",
      membershipRole: "member",
      enabledTenantExtensions: ["bi-report"],
      focusAreas: ["renewal"],
    },
  }),
}));

const failures = responses.flatMap(({ scenario, response }) => {
  const responseFailures: string[] = [];
  if (!response.voice) {
    responseFailures.push(`${scenario.id}: missing voice metadata`);
    return responseFailures;
  }
  if (response.voice.rawAudioRetained !== false) {
    responseFailures.push(`${scenario.id}: raw audio retained`);
  }
  if (response.voice.voiceOnlyApprovalAllowed !== false) {
    responseFailures.push(`${scenario.id}: voice-only approval allowed`);
  }
  if (
    response.voice.requiresTranscriptConfirmation !==
    scenario.requiresTranscriptConfirmation
  ) {
    responseFailures.push(`${scenario.id}: transcript confirmation mismatch`);
  }
  if (response.voice.speakableSummary !== response.answer.summary) {
    responseFailures.push(`${scenario.id}: speakable summary not grounded`);
  }
  if (response.voice.speakableBoundary !== response.boundaryNote?.message) {
    responseFailures.push(`${scenario.id}: speakable boundary not grounded`);
  }
  if (
    scenario.expectedBoundary &&
    response.boundaryNote?.type !== scenario.expectedBoundary
  ) {
    responseFailures.push(`${scenario.id}: expected review boundary`);
  }
  if (!response.retrievalPlan.readOnly || response.retrievalPlan.writePath) {
    responseFailures.push(`${scenario.id}: write path enabled`);
  }

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
        boundaryType: response.boundaryNote?.type,
        voice: response.voice,
        writePath: response.retrievalPlan.writePath,
      })),
    },
    null,
    2,
  ),
);

if (failures.length) {
  process.exit(1);
}
