import {
  WorkBuddyCollaborationError,
} from "./contracts";

export function assertWorkBuddyRequestActive(
  signal?: AbortSignal,
): void {
  if (!signal?.aborted) return;
  throw new WorkBuddyCollaborationError(
    "REQUEST_DEADLINE_EXCEEDED",
    "The WorkBuddy request deadline was exceeded.",
    true,
  );
}
