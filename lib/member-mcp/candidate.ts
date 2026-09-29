import "server-only";

// Materializes a member work-signal receipt into the reviewable candidate the
// /approvals member-signal panel lists (listMemberWorkSignalCandidateReviews).
// The receipt is durable evidence on its own: a failed materialization never
// undoes it. The failure is reported with a closed-set code to the caller and
// logged server-side — never swallowed silently.

import {
  MemberSignalCandidateError,
  materializeMemberWorkSignalCandidate,
} from "@/lib/member-gateway/signal-candidate-materializer";
import type { MemberSignalCandidateObjectAnchor } from "@/lib/member-gateway/signal-candidate";

export const MEMBER_CANDIDATE_FAILURE_CODES = [
  "candidate_unsafe_text",
  "candidate_invalid",
  "candidate_failed",
] as const;

export type MemberCandidateOutcome =
  | { candidateMaterialized: true; candidateBundleRef: string; candidateCode: null }
  | {
      candidateMaterialized: false;
      candidateBundleRef: null;
      candidateCode: (typeof MEMBER_CANDIDATE_FAILURE_CODES)[number];
    };

export async function materializeMemberSignalCandidateSafely(input: {
  workspaceId: string;
  signalReceiptId: string;
  objectAnchor: MemberSignalCandidateObjectAnchor;
}): Promise<MemberCandidateOutcome> {
  try {
    const result = await materializeMemberWorkSignalCandidate(input);
    return { candidateMaterialized: true, candidateBundleRef: result.artifactBundleId, candidateCode: null };
  } catch (error) {
    const code: (typeof MEMBER_CANDIDATE_FAILURE_CODES)[number] =
      error instanceof MemberSignalCandidateError
        ? error.message.startsWith("unsafe_candidate_text")
          ? "candidate_unsafe_text"
          : "candidate_invalid"
        : "candidate_failed";
    console.error(
      JSON.stringify({
        event: "member_mcp_candidate_materialize_failed",
        workspaceId: input.workspaceId,
        signalReceiptId: input.signalReceiptId,
        code,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { candidateMaterialized: false, candidateBundleRef: null, candidateCode: code };
  }
}
