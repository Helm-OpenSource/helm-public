import askHelmActionIntentCases from "@/evals/ask-helm/action-intents.json";
import {
  classifyAskHelmQueryIntent,
  isAskHelmIntentType,
  isAskHelmPrimaryTarget,
  type AskHelmIntentType,
  type AskHelmQueryIntentSample,
} from "@/features/search/ask-helm-query-intent";
import { toRate } from "@/lib/evals/shared";

export const ASK_HELM_ACTION_INTENT_TYPES = [
  "plan_breakdown",
  "prepare_draft",
  "prepare_review_packet",
  "queue_internal_followup",
  "request_handoff",
  "request_execution",
  "review_required_execution",
  "unsupported_open_domain",
  "cross_workspace_denied",
] as const satisfies AskHelmIntentType[];

export type AskHelmActionIntentType =
  (typeof ASK_HELM_ACTION_INTENT_TYPES)[number];

export type AskHelmActionIntentEvalCaseResult = {
  id: string;
  query: string;
  expectedIntentType: AskHelmActionIntentType;
  actualIntentType: AskHelmIntentType;
  passed: boolean;
  failures: string[];
  matchedRule: string;
};

export type AskHelmActionIntentEvalSummary = {
  minimumPassRate: number;
  totalCases: number;
  passedCases: number;
  passRate: number;
  meetsMinimumPassRate: boolean;
  byIntent: Array<{
    intentType: AskHelmActionIntentType;
    totalCases: number;
    passedCases: number;
    passRate: number;
    failedCaseIds: string[];
  }>;
  cases: AskHelmActionIntentEvalCaseResult[];
};

function isAskHelmActionIntentType(
  value: AskHelmIntentType,
): value is AskHelmActionIntentType {
  return ASK_HELM_ACTION_INTENT_TYPES.includes(
    value as AskHelmActionIntentType,
  );
}

export function loadAskHelmActionIntentCases() {
  return (askHelmActionIntentCases as AskHelmQueryIntentSample[]).map((item) => {
    if (!isAskHelmIntentType(item.intentType)) {
      throw new Error(`Unknown Ask Helm intent type: ${String(item.intentType)}`);
    }
    if (!isAskHelmActionIntentType(item.intentType)) {
      throw new Error(
        `Ask Helm action eval contains non-action intent: ${String(item.intentType)}`,
      );
    }
    if (!isAskHelmPrimaryTarget(item.expectedPrimaryTarget)) {
      throw new Error(
        `Unknown Ask Helm primary target: ${String(item.expectedPrimaryTarget)}`,
      );
    }
    return {
      ...item,
      intentType: item.intentType,
    } as AskHelmQueryIntentSample & { intentType: AskHelmActionIntentType };
  });
}

export function runAskHelmActionIntentEval(
  minimumPassRate = 90,
): AskHelmActionIntentEvalSummary {
  const results =
    loadAskHelmActionIntentCases().map<AskHelmActionIntentEvalCaseResult>(
      (item) => {
        const classification = classifyAskHelmQueryIntent(item.query);
        const failures: string[] = [];

        if (classification.intentType !== item.intentType) {
          failures.push(
            `intentType mismatch: expected ${item.intentType}, got ${classification.intentType}`,
          );
        }
        if (classification.needsObjectContext !== item.needsObjectContext) {
          failures.push(
            `needsObjectContext mismatch: expected ${item.needsObjectContext}, got ${classification.needsObjectContext}`,
          );
        }
        if (classification.needsMemory !== item.needsMemory) {
          failures.push(
            `needsMemory mismatch: expected ${item.needsMemory}, got ${classification.needsMemory}`,
          );
        }
        if (classification.needsSystemKnowledge !== item.needsSystemKnowledge) {
          failures.push(
            `needsSystemKnowledge mismatch: expected ${item.needsSystemKnowledge}, got ${classification.needsSystemKnowledge}`,
          );
        }
        if (classification.primaryTarget !== item.expectedPrimaryTarget) {
          failures.push(
            `primaryTarget mismatch: expected ${item.expectedPrimaryTarget}, got ${classification.primaryTarget}`,
          );
        }

        return {
          id: item.id,
          query: item.query,
          expectedIntentType: item.intentType,
          actualIntentType: classification.intentType,
          passed: failures.length === 0,
          failures,
          matchedRule: classification.matchedRule,
        };
      },
    );
  const passedCases = results.filter((result) => result.passed).length;

  return {
    minimumPassRate,
    totalCases: results.length,
    passedCases,
    passRate: toRate(passedCases, results.length),
    meetsMinimumPassRate: toRate(passedCases, results.length) >= minimumPassRate,
    byIntent: ASK_HELM_ACTION_INTENT_TYPES.map((intentType) => {
      const intentCases = results.filter(
        (result) => result.expectedIntentType === intentType,
      );
      const intentPassedCases = intentCases.filter((result) => result.passed).length;

      return {
        intentType,
        totalCases: intentCases.length,
        passedCases: intentPassedCases,
        passRate: toRate(intentPassedCases, intentCases.length),
        failedCaseIds: intentCases
          .filter((result) => !result.passed)
          .map((result) => result.id),
      };
    }),
    cases: results,
  };
}
