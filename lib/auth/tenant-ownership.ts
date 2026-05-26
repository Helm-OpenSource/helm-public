import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";

const WORKSPACE_OWNERSHIP_ERROR_CODE = "WORKSPACE_OWNERSHIP_MISMATCH";

function buildOwnershipError(label: string) {
  const error = new Error(`${label} not found in active workspace`) as Error & {
    code?: string;
  };
  error.code = WORKSPACE_OWNERSHIP_ERROR_CODE;
  return error;
}

export function isWorkspaceOwnershipError(error: unknown): error is Error & { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === WORKSPACE_OWNERSHIP_ERROR_CODE,
  );
}

export async function assertWorkspaceOwnership(workspaceId: string, candidateWorkspaceId: string) {
  if (workspaceId !== candidateWorkspaceId) {
    throw buildOwnershipError("workspace");
  }
}

export async function assertWorkspaceObjectOwnership(input: {
  workspaceId: string;
  objectType: ObjectType;
  objectId: string;
}) {
  const { workspaceId, objectType, objectId } = input;

  const record =
    objectType === ObjectType.CONTACT
      ? await db.contact.findFirst({
          where: {
            id: objectId,
            workspaceId,
          },
          select: { id: true },
        })
      : objectType === ObjectType.COMPANY
        ? await db.company.findFirst({
            where: {
              id: objectId,
              workspaceId,
            },
            select: { id: true },
          })
        : objectType === ObjectType.OPPORTUNITY
          ? await db.opportunity.findFirst({
              where: {
                id: objectId,
                workspaceId,
              },
              select: { id: true },
            })
          : objectType === ObjectType.MEETING
            ? await db.meeting.findFirst({
                where: {
                  id: objectId,
                  workspaceId,
                },
                select: { id: true },
              })
            : objectType === ObjectType.ACTION_ITEM
              ? await db.actionItem.findFirst({
                  where: {
                    id: objectId,
                    workspaceId,
                  },
                  select: { id: true },
                })
              : objectType === ObjectType.APPROVAL_TASK
                ? await db.approvalTask.findFirst({
                    where: {
                      id: objectId,
                      workspaceId,
                    },
                    select: { id: true },
                  })
                : objectType === ObjectType.POLICY_RULE
                  ? await db.policyRule.findFirst({
                      where: {
                        id: objectId,
                        workspaceId,
                      },
                      select: { id: true },
                    })
                  : objectType === ObjectType.EMAIL_THREAD
                    ? await db.emailThread.findFirst({
                        where: {
                          id: objectId,
                          workspaceId,
                        },
                        select: { id: true },
                      })
                    : null;

  if (!record) {
    throw buildOwnershipError(objectType.toLowerCase());
  }
}

export async function assertWorkspaceMeetingOwnership(workspaceId: string, meetingId: string) {
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!meeting) {
    throw buildOwnershipError("meeting");
  }
}

export async function assertWorkspaceCaptureSessionOwnership(workspaceId: string, captureSessionId: string) {
  const session = await db.captureSession.findFirst({
    where: {
      id: captureSessionId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!session) {
    throw buildOwnershipError("capture session");
  }
}

export async function assertWorkspaceRecommendationOwnership(workspaceId: string, recommendationId: string) {
  const recommendation = await db.recommendationLog.findFirst({
    where: {
      id: recommendationId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!recommendation) {
    throw buildOwnershipError("recommendation");
  }
}

export async function assertWorkspaceStrategySuggestionOwnership(workspaceId: string, suggestionId: string) {
  const suggestion = await db.strategySuggestion.findFirst({
    where: {
      id: suggestionId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!suggestion) {
    throw buildOwnershipError("strategy suggestion");
  }
}

export async function assertWorkspaceSkillSuggestionOwnership(workspaceId: string, suggestionId: string) {
  const suggestion = await db.skillSuggestion.findFirst({
    where: {
      id: suggestionId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!suggestion) {
    throw buildOwnershipError("skill suggestion");
  }
}

export async function assertWorkspaceRuntimeSessionOwnership(workspaceId: string, sessionId: string) {
  const session = await db.runtimeSession.findFirst({
    where: {
      id: sessionId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!session) {
    throw buildOwnershipError("runtime session");
  }
}

export async function assertWorkspaceRuntimeCheckpointOwnership(workspaceId: string, checkpointId: string) {
  const checkpoint = await db.sessionCheckpoint.findFirst({
    where: {
      id: checkpointId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!checkpoint) {
    throw buildOwnershipError("runtime checkpoint");
  }
}

export async function assertWorkspaceRuntimeArtifactOwnership(workspaceId: string, artifactBundleId: string) {
  const artifact = await db.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!artifact) {
    throw buildOwnershipError("runtime artifact");
  }
}

export async function assertWorkspaceProblemSpaceOwnership(workspaceId: string, problemSpaceId: string) {
  const problemSpace = await db.problemSpace.findFirst({
    where: {
      id: problemSpaceId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!problemSpace) {
    throw buildOwnershipError("problem space");
  }
}

export async function assertWorkspaceConsolidationJobOwnership(workspaceId: string, jobId: string) {
  const job = await db.consolidationJob.findFirst({
    where: {
      id: jobId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!job) {
    throw buildOwnershipError("consolidation job");
  }
}

export async function assertWorkspaceReflectionJobOwnership(workspaceId: string, jobId: string) {
  const job = await db.consolidationJob.findFirst({
    where: {
      id: jobId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!job) {
    throw buildOwnershipError("reflection job");
  }
}

export async function assertWorkspaceImportSourceOwnership(workspaceId: string, sourceId: string) {
  const source = await db.importSource.findFirst({
    where: {
      id: sourceId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!source) {
    throw buildOwnershipError("import source");
  }
}

export async function assertWorkspaceImportJobOwnership(workspaceId: string, jobId: string) {
  const job = await db.importJob.findFirst({
    where: {
      id: jobId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!job) {
    throw buildOwnershipError("import job");
  }
}

export async function assertWorkspaceImportConflictOwnership(workspaceId: string, conflictId: string) {
  const match = await db.identityMatch.findFirst({
    where: {
      id: conflictId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!match) {
    throw buildOwnershipError("import conflict");
  }
}

export async function assertWorkspaceImportItemOwnership(workspaceId: string, itemId: string) {
  const item = await db.importItem.findFirst({
    where: {
      id: itemId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!item) {
    throw buildOwnershipError("import item");
  }
}

export async function assertWorkspaceMemoryFactOwnership(workspaceId: string, memoryFactId: string) {
  const fact = await db.memoryFact.findFirst({
    where: {
      id: memoryFactId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!fact) {
    throw buildOwnershipError("memory fact");
  }
}

export async function assertWorkspaceMemoryCandidateOwnership(workspaceId: string, candidateId: string) {
  const candidate = await db.memoryCandidate.findFirst({
    where: {
      id: candidateId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!candidate) {
    throw buildOwnershipError("memory candidate");
  }
}

export async function assertWorkspaceCommitmentOwnership(workspaceId: string, commitmentId: string) {
  const commitment = await db.commitment.findFirst({
    where: {
      id: commitmentId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!commitment) {
    throw buildOwnershipError("commitment");
  }
}

export async function assertWorkspaceBlockerOwnership(workspaceId: string, blockerId: string) {
  const blocker = await db.blocker.findFirst({
    where: {
      id: blockerId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!blocker) {
    throw buildOwnershipError("blocker");
  }
}

export async function assertWorkspaceActionItemOwnership(workspaceId: string, actionItemId: string) {
  const actionItem = await db.actionItem.findFirst({
    where: {
      id: actionItemId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!actionItem) {
    throw buildOwnershipError("action item");
  }
}

export async function assertWorkspaceApprovalTaskOwnership(workspaceId: string, approvalTaskId: string) {
  const approvalTask = await db.approvalTask.findFirst({
    where: {
      id: approvalTaskId,
      workspaceId,
    },
    select: { id: true },
  });

  if (!approvalTask) {
    throw buildOwnershipError("approval task");
  }
}

export async function assertWorkspaceRelatedObjectOwnership(input: {
  workspaceId: string;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  meetingId?: string | null;
}) {
  if (input.contactId) {
    await assertWorkspaceObjectOwnership({
      workspaceId: input.workspaceId,
      objectType: ObjectType.CONTACT,
      objectId: input.contactId,
    });
  }

  if (input.companyId) {
    await assertWorkspaceObjectOwnership({
      workspaceId: input.workspaceId,
      objectType: ObjectType.COMPANY,
      objectId: input.companyId,
    });
  }

  if (input.opportunityId) {
    await assertWorkspaceObjectOwnership({
      workspaceId: input.workspaceId,
      objectType: ObjectType.OPPORTUNITY,
      objectId: input.opportunityId,
    });
  }

  if (input.meetingId) {
    await assertWorkspaceMeetingOwnership(input.workspaceId, input.meetingId);
  }
}

export async function assertWorkspaceSignalObjectOwnership(input: {
  workspaceId: string;
  meetingId?: string;
  opportunityId?: string;
  companyId?: string;
}) {
  if (input.meetingId) {
    await assertWorkspaceMeetingOwnership(input.workspaceId, input.meetingId);
  }

  if (input.opportunityId) {
    await assertWorkspaceObjectOwnership({
      workspaceId: input.workspaceId,
      objectType: ObjectType.OPPORTUNITY,
      objectId: input.opportunityId,
    });
  }

  if (input.companyId) {
    await assertWorkspaceObjectOwnership({
      workspaceId: input.workspaceId,
      objectType: ObjectType.COMPANY,
      objectId: input.companyId,
    });
  }
}
