import "server-only";

import { subDays } from "date-fns";
import { WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import type { UiLocale } from "@/lib/i18n/config";
import { getLocalizedRoleLabels } from "@/lib/i18n/labels";
import {
  buildMemoryItemAnchor,
  buildSectionHref,
  APPROVAL_PAGE_ANCHORS,
} from "@/lib/presentation/page-section-anchors";
import {
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  buildWorkspaceFirstLoopModel,
  type FirstLoopProgressStatus,
  type WorkspaceFirstLoopCandidate,
} from "@/lib/operating-system/first-loop";
import { safeParseJson } from "@/lib/utils";

type GetWorkspaceFirstLoopModelInput = {
  workspaceId: string;
  currentUserId: string;
  locale: UiLocale;
  membershipRole: WorkspaceRole;
  profileType: string | null;
  focusAreasJson: string | null;
};

type FirstLoopAnchorPayload = {
  href: string;
  label: string;
  summary: string;
};

function getFocusAreas(value: string | null) {
  const parsed = safeParseJson<unknown[]>(value, []);
  return parsed
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (
        item &&
        typeof item === "object" &&
        "label" in item &&
        typeof item.label === "string"
      ) {
        return item.label.trim();
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function getObjectHref(input: {
  meeting?: { id: string; title?: string | null } | null;
  opportunity?: { id: string; title?: string | null } | null;
  contact?: { id: string; name?: string | null } | null;
}) {
  if (input.meeting?.id) {
    return `/meetings/${input.meeting.id}`;
  }
  if (input.opportunity?.id) {
    return `/opportunities?opportunityId=${input.opportunity.id}`;
  }
  if (input.contact?.id) {
    return `/contacts/${input.contact.id}`;
  }
  return "/dashboard";
}

function describeContext(
  input: {
    english: boolean;
    meeting?: { title: string | null } | null;
    opportunity?: { title: string | null; company?: { name: string | null } | null } | null;
    contact?: { name: string | null } | null;
  },
) {
  if (input.meeting?.title) {
    return input.english
      ? `from meeting "${input.meeting.title}"`
      : `来自会议“${input.meeting.title}”`;
  }
  if (input.opportunity?.title) {
    return input.english
      ? `on opportunity "${input.opportunity.title}"`
      : `围绕机会“${input.opportunity.title}”`;
  }
  if (input.contact?.name) {
    return input.english
      ? `for contact "${input.contact.name}"`
      : `围绕联系人“${input.contact.name}”`;
  }
  return input.english ? "inside the current workspace" : "围绕当前工作区";
}

function buildRoleGoalCandidate(input: {
  english: boolean;
  roleLabel: string;
  profileType: string | null;
  focusAreas: string[];
}): WorkspaceFirstLoopCandidate & { status: FirstLoopProgressStatus } {
  if (input.profileType && input.focusAreas.length > 0) {
    return {
      label: input.english
        ? `${input.roleLabel} posture is narrowed`
        : `${input.roleLabel} 姿态已经收窄`,
      summary: input.english
        ? `Current focus is already narrowed to ${input.focusAreas.slice(0, 2).join(", ")}. Keep the first loop anchored to one live signal instead of adding more setup.`
        : `当前 focus 已经收窄到 ${input.focusAreas.slice(0, 2).join("、")}。接下来要把首轮闭环锚定到一条实时信号，而不是继续加 setup。`,
      href: "/setup",
      status: "done",
    };
  }

  return {
    label: input.english ? "Finish persona and focus" : "先完成 persona 与 focus",
    summary: input.english
      ? `Role is already ${input.roleLabel}. Add one or two focus areas, then move straight into the first live signal.`
      : `当前角色已经是 ${input.roleLabel}。再补上一两个 focus area，然后直接进入第一条实时信号。`,
    href: "/setup",
    status: "ready",
  };
}

function buildSignalCandidate(input: {
  english: boolean;
  pendingApprovalTask: {
    id: string;
    actionItem: {
      title: string;
      meeting: { id: string; title: string | null } | null;
      opportunity: {
        id: string;
        title: string;
        company: { name: string | null } | null;
      } | null;
      contact: { id: string; name: string | null } | null;
    };
  } | null;
  suggestedAction: {
    id: string;
    title: string;
    meeting: { id: string; title: string | null } | null;
    opportunity: {
      id: string;
      title: string;
      company: { name: string | null } | null;
    } | null;
    contact: { id: string; name: string | null } | null;
  } | null;
  meeting: {
    id: string;
    title: string;
    company: { name: string | null } | null;
  } | null;
  opportunity: {
    id: string;
    title: string;
    company: { name: string | null } | null;
    nextAction: string | null;
  } | null;
}) {
  if (input.pendingApprovalTask) {
    return {
      candidate: {
        label: input.pendingApprovalTask.actionItem.title,
        summary: input.english
          ? `A real signal is already waiting in the review queue ${describeContext({
              english: input.english,
              meeting: input.pendingApprovalTask.actionItem.meeting,
              opportunity: input.pendingApprovalTask.actionItem.opportunity,
              contact: input.pendingApprovalTask.actionItem.contact,
            })}.`
          : `当前已经有一条真实信号正在复核队列里等待处理，${describeContext({
              english: input.english,
              meeting: input.pendingApprovalTask.actionItem.meeting,
              opportunity: input.pendingApprovalTask.actionItem.opportunity,
              contact: input.pendingApprovalTask.actionItem.contact,
            })}。`,
        href: `/approvals?approvalId=${input.pendingApprovalTask.id}`,
      },
      status: "done" as const,
    };
  }

  if (input.suggestedAction) {
    return {
      candidate: {
        label: input.suggestedAction.title,
        summary: input.english
          ? `The first real signal is already visible ${describeContext({
              english: input.english,
              meeting: input.suggestedAction.meeting,
              opportunity: input.suggestedAction.opportunity,
              contact: input.suggestedAction.contact,
            })}.`
          : `第一条真实信号已经可见，${describeContext({
              english: input.english,
              meeting: input.suggestedAction.meeting,
              opportunity: input.suggestedAction.opportunity,
              contact: input.suggestedAction.contact,
            })}。`,
        href: getObjectHref({
          meeting: input.suggestedAction.meeting,
          opportunity: input.suggestedAction.opportunity,
          contact: input.suggestedAction.contact,
        }),
      },
      status: "done" as const,
    };
  }

  if (input.meeting) {
    return {
      candidate: {
        label: input.meeting.title,
        summary: input.english
          ? `Use this live meeting with ${input.meeting.company?.name ?? "the current workspace"} as the first signal instead of waiting for a full CRM or knowledge base.`
          : `先用这场和 ${input.meeting.company?.name ?? "当前工作区"} 相关的真实会议作为第一条信号，不要等完整 CRM 或知识库。`,
        href: `/meetings/${input.meeting.id}`,
      },
      status: "done" as const,
    };
  }

  if (input.opportunity) {
    return {
      candidate: {
        label: input.opportunity.title,
        summary: input.english
          ? `This active opportunity is already warm enough to act as the first signal before the chain cools down.`
          : "这条活跃机会已经足够热，可以先作为第一条信号，而不是等链路重新降温。",
        href: `/opportunities?opportunityId=${input.opportunity.id}`,
      },
      status: "done" as const,
    };
  }

  return {
    candidate: null,
    status: "ready" as const,
  };
}

function buildSuggestionCandidate(input: {
  english: boolean;
  pendingApprovalTask: {
    id: string;
    actionItem: {
      title: string;
      description: string | null;
      meeting: { id: string; title: string | null } | null;
      opportunity: { id: string; title: string; company: { name: string | null } | null } | null;
      contact: { id: string; name: string | null } | null;
    };
  } | null;
  suggestedAction: {
    title: string;
    description: string | null;
    meeting: { id: string; title: string | null } | null;
    opportunity: { id: string; title: string; company: { name: string | null } | null } | null;
    contact: { id: string; name: string | null } | null;
  } | null;
  meeting: { id: string; title: string } | null;
  opportunity: { id: string; title: string; nextAction: string | null } | null;
  signalReady: boolean;
}) {
  if (input.pendingApprovalTask) {
    return {
      candidate: {
        label: input.pendingApprovalTask.actionItem.title,
        summary:
          input.pendingApprovalTask.actionItem.description ??
          (input.english
            ? "This move is already narrow enough to review before it becomes any commitment."
            : "这条动作已经足够收窄，可以先复核，再决定是否变成任何承诺。"),
        href: `/approvals?approvalId=${input.pendingApprovalTask.id}`,
      },
      status: "done" as const,
    };
  }

  if (input.suggestedAction) {
    return {
      candidate: {
        label: input.suggestedAction.title,
        summary:
          input.suggestedAction.description ??
          (input.english
            ? "The first suggestion is already visible and can be kept inside explicit review."
            : "第一条建议已经可见，可以继续保持在显式复核里。"),
        href: getObjectHref({
          meeting: input.suggestedAction.meeting,
          opportunity: input.suggestedAction.opportunity,
          contact: input.suggestedAction.contact,
        }),
      },
      status: "done" as const,
    };
  }

  if (input.meeting) {
    return {
      candidate: {
        label: input.english
          ? `Turn "${input.meeting.title}" into the first next step`
          : `把“${input.meeting.title}”收成第一条下一步`,
        summary: input.english
          ? "Move from meeting context into one narrow, reviewable next action."
          : "先把会议上下文收成一条窄而且可复核的 下动作。",
        href: `/meetings/${input.meeting.id}`,
      },
      status: input.signalReady ? ("ready" as const) : ("blocked" as const),
    };
  }

  if (input.opportunity?.nextAction) {
    return {
      candidate: {
        label: input.opportunity.nextAction,
        summary: input.english
          ? `Use the next action already visible on "${input.opportunity.title}" as the first narrow suggestion.`
          : `先把“${input.opportunity.title}”上已经可见的 下一 动作当成第一条窄建议。`,
        href: `/opportunities?opportunityId=${input.opportunity.id}`,
      },
      status: input.signalReady ? ("ready" as const) : ("blocked" as const),
    };
  }

  return {
    candidate: null,
    status: input.signalReady ? ("watch" as const) : ("blocked" as const),
  };
}

function buildReviewCandidate(input: {
  english: boolean;
  pendingApprovalTask: {
    id: string;
    actionItem: {
      title: string;
      meeting: { id: string; title: string | null } | null;
      opportunity: { id: string; title: string } | null;
      contact: { id: string; name: string | null } | null;
    };
  } | null;
  suggestedAction: {
    title: string;
    meeting: { id: string; title: string | null } | null;
    opportunity: { id: string; title: string } | null;
    contact: { id: string; name: string | null } | null;
  } | null;
  reviewedApprovalCount: number;
}) {
  if (input.pendingApprovalTask) {
    return {
      candidate: {
        label: input.english
          ? `Review ${input.pendingApprovalTask.actionItem.title}`
          : `先复核 ${input.pendingApprovalTask.actionItem.title}`,
        summary: input.english
          ? "This is the explicit review-before-commitment gate for the first loop."
          : "这里就是第一次闭环的显式承诺前复核入口。",
        href: `/approvals?approvalId=${input.pendingApprovalTask.id}#${APPROVAL_PAGE_ANCHORS.preview}`,
      },
      status: "ready" as const,
    };
  }

  if (input.reviewedApprovalCount > 0) {
    return {
      candidate: {
        label: input.english ? "The first review gate is already visible" : "第一道复核入口已经可见",
        summary: input.english
          ? `${input.reviewedApprovalCount} reviewed approval items already prove that the first loop is not skipping formal review.`
          : `当前已有 ${input.reviewedApprovalCount} 条已复核审批项，说明第一次闭环没有跳过正式复核。`,
        href: "/approvals",
      },
      status: "done" as const,
    };
  }

  if (input.suggestedAction) {
    return {
      candidate: {
        label: input.english ? "Keep the first move inside review" : "把第一条动作保留在复核里",
        summary: input.english
          ? `Open "${input.suggestedAction.title}" and keep the first move reviewable before it becomes a commitment.`
          : `打开“${input.suggestedAction.title}”，先把这条动作保持在可复核状态，不要让它直接滑成承诺。`,
        href: getObjectHref({
          meeting: input.suggestedAction.meeting,
          opportunity: input.suggestedAction.opportunity,
          contact: input.suggestedAction.contact,
        }),
      },
      status: "watch" as const,
    };
  }

  return {
    candidate: null,
    status: "blocked" as const,
  };
}

function buildFollowThroughCandidate(input: {
  english: boolean;
  executedAction: {
    title: string;
    meeting: { id: string; title: string | null } | null;
    opportunity: { id: string; title: string } | null;
    contact: { id: string; name: string | null } | null;
  } | null;
  suggestedAction: {
    title: string;
    meeting: { id: string; title: string | null } | null;
    opportunity: { id: string; title: string } | null;
    contact: { id: string; name: string | null } | null;
  } | null;
  pendingApprovalTask: { id: string; actionItem: { title: string } } | null;
}) {
  if (input.executedAction) {
    return {
      candidate: {
        label: input.executedAction.title,
        summary: input.english
          ? "One concrete move has already crossed from review into real follow-through."
          : "已经有一条具体动作从复核进入真实推进。",
        href: getObjectHref({
          meeting: input.executedAction.meeting,
          opportunity: input.executedAction.opportunity,
          contact: input.executedAction.contact,
        }),
      },
      status: "done" as const,
    };
  }

  if (input.pendingApprovalTask) {
    return {
      candidate: {
        label: input.english
          ? `Route ${input.pendingApprovalTask.actionItem.title} after review`
          : `复核后推进 ${input.pendingApprovalTask.actionItem.title}`,
        summary: input.english
          ? "Once the review gate clears, keep the follow-through narrow and explicit."
          : "一旦复核入口放行，就把后续推进保持窄而且显式。",
        href: `/approvals?approvalId=${input.pendingApprovalTask.id}`,
      },
      status: "ready" as const,
    };
  }

  if (input.suggestedAction) {
    return {
      candidate: {
        label: input.suggestedAction.title,
        summary: input.english
          ? "The next move is visible, but it still needs a real follow-through rather than staying as a suggestion."
          : "下一步已经可见，但它还需要真实推进，而不是继续停在建议层。",
        href: getObjectHref({
          meeting: input.suggestedAction.meeting,
          opportunity: input.suggestedAction.opportunity,
          contact: input.suggestedAction.contact,
        }),
      },
      status: "watch" as const,
    };
  }

  return {
    candidate: null,
    status: "blocked" as const,
  };
}

function buildMemoryCandidate(input: {
  english: boolean;
  memoryFact: { id: string; title: string } | null;
  commitment: { id: string; title: string } | null;
  blocker: { id: string; title: string } | null;
  hasFollowThrough: boolean;
}) {
  if (input.memoryFact) {
    return {
      candidate: {
        label: input.memoryFact.title,
        summary: input.english
          ? "A structured memory fact is already available as evidence for the first loop."
          : "当前已经有结构化记忆事实可以作为第一次闭环的证据。",
        href: buildSectionHref(
          "/memory",
          buildMemoryItemAnchor("fact", input.memoryFact.id),
        ),
      },
      status: "done" as const,
    };
  }

  if (input.commitment) {
    return {
      candidate: {
        label: input.commitment.title,
        summary: input.english
          ? "A commitment has already landed in memory, so the loop is leaving more than notes behind."
          : "当前已有承诺事项落进记忆层，说明这条回路留下的不只是纪要。",
        href: buildSectionHref(
          "/memory",
          buildMemoryItemAnchor("commitment", input.commitment.id),
        ),
      },
      status: "done" as const,
    };
  }

  if (input.blocker) {
    return {
      candidate: {
        label: input.blocker.title,
        summary: input.english
          ? "A blocker is already visible in memory, so the boundary trace is not being lost."
          : "当前已经有阻塞事项进入记忆层，说明边界痕迹没有丢回纪要里。",
        href: buildSectionHref(
          "/memory",
          buildMemoryItemAnchor("blocker", input.blocker.id),
        ),
      },
      status: "done" as const,
    };
  }

  if (input.hasFollowThrough) {
    return {
      candidate: {
        label: input.english ? "Write the first result back now" : "现在就把第一条结果写回去",
        summary: input.english
          ? "The follow-through has started. Now make the memory, decision trace and boundary trace explicit."
          : "后续推进已经开始了。现在需要把记忆、决策痕迹和边界痕迹写清楚。",
        href: "/memory",
      },
      status: "ready" as const,
    };
  }

  return {
    candidate: null,
    status: "blocked" as const,
  };
}

function buildAnchorCandidate(input: {
  english: boolean;
  memoryCandidate: WorkspaceFirstLoopCandidate | null;
  signalCandidate: WorkspaceFirstLoopCandidate | null;
  reviewCandidate: WorkspaceFirstLoopCandidate | null;
  explicitAnchor: FirstLoopAnchorPayload | null;
  hasMemory: boolean;
}) {
  if (input.explicitAnchor) {
    return {
      candidate: {
        label: input.explicitAnchor.label,
        summary: input.explicitAnchor.summary,
        href: input.explicitAnchor.href,
      },
      status: "done" as const,
    };
  }

  if (input.reviewCandidate) {
    return {
      candidate: {
        label: input.english ? "Return to the current review block" : "回到当前复核区块",
        summary: input.english
          ? "The next visit should reopen the same review block instead of scanning the whole workspace again."
          : "下一次回来先重开同一个复核区块，不要重新把整个工作区扫一遍。",
        href: input.reviewCandidate.href,
      },
      status: input.hasMemory ? ("done" as const) : ("ready" as const),
    };
  }

  if (input.signalCandidate) {
    return {
      candidate: {
        label: input.signalCandidate.label,
        summary: input.english
          ? "Keep the next visit anchored on the same live signal until the first loop feels natural."
          : "在第一次闭环还没变自然前，把下一次进入继续锚定在同一条真实信号上。",
        href: input.signalCandidate.href,
      },
      status: input.hasMemory ? ("done" as const) : ("ready" as const),
    };
  }

  if (input.memoryCandidate) {
    return {
      candidate: {
        label: input.english ? "Return through memory and dashboard" : "从记忆和工作台接着回来",
        summary: input.english
          ? "The next visit should reopen the latest trace before widening scope."
          : "下一次回来先重开最近那条痕迹，再决定要不要扩大范围。",
        href: input.memoryCandidate.href,
      },
      status: input.hasMemory ? ("done" as const) : ("ready" as const),
    };
  }

  return {
    candidate: null,
    status: "watch" as const,
  };
}

export async function getWorkspaceFirstLoopModel(
  input: GetWorkspaceFirstLoopModelInput,
) {
  const english = input.locale === "en-US";
  const since = subDays(new Date(), 14);
  const roleLabels = getLocalizedRoleLabels(input.locale);
  const focusAreas = getFocusAreas(input.focusAreasJson);

  const [
    pendingApprovalTask,
    suggestedAction,
    executedAction,
    recentMeeting,
    hotOpportunity,
    reviewedApprovalCount,
    recentMemoryFact,
    recentCommitment,
    recentBlocker,
    explicitAnchorAudit,
  ] = await Promise.all([
    db.approvalTask.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: "PENDING",
      },
      include: {
        actionItem: {
          select: {
            title: true,
            description: true,
            meeting: { select: { id: true, title: true } },
            opportunity: {
              select: {
                id: true,
                title: true,
                company: { select: { name: true } },
              },
            },
            contact: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.actionItem.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: {
          in: ["PENDING_APPROVAL", "MANUAL"],
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        meeting: { select: { id: true, title: true } },
        opportunity: {
          select: {
            id: true,
            title: true,
            company: { select: { name: true } },
          },
        },
        contact: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    db.actionItem.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: "EXECUTED",
      },
      select: {
        id: true,
        title: true,
        meeting: { select: { id: true, title: true } },
        opportunity: { select: { id: true, title: true } },
        contact: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.meeting.findFirst({
      where: {
        workspaceId: input.workspaceId,
        startsAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        title: true,
        company: { select: { name: true } },
      },
      orderBy: { startsAt: "desc" },
    }),
    db.opportunity.findFirst({
      where: {
        workspaceId: input.workspaceId,
        stage: {
          notIn: ["DONE", "LOST"],
        },
      },
      select: {
        id: true,
        title: true,
        nextAction: true,
        company: { select: { name: true } },
      },
      orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
    }),
    db.approvalTask.count({
      where: {
        workspaceId: input.workspaceId,
        reviewedAt: {
          gte: since,
        },
        status: {
          in: ["EXECUTED", "REJECTED"],
        },
      },
    }),
    db.memoryFact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        objectId: {
          not: "",
        },
        updatedAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.commitment.findFirst({
      where: {
        workspaceId: input.workspaceId,
        updatedAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.blocker.findFirst({
      where: {
        workspaceId: input.workspaceId,
        updatedAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.auditLog.findFirst({
      where: {
        workspaceId: input.workspaceId,
        userId: input.currentUserId,
        actionType: FIRST_LOOP_RETURN_ANCHOR_ACTION,
      },
      select: {
        payload: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const explicitAnchorPayloadRaw = safeParseJson<Partial<FirstLoopAnchorPayload> | null>(
    explicitAnchorAudit?.payload,
    null,
  );
  const explicitAnchor =
    explicitAnchorPayloadRaw &&
    typeof explicitAnchorPayloadRaw.href === "string" &&
    explicitAnchorPayloadRaw.href.startsWith("/") &&
    typeof explicitAnchorPayloadRaw.label === "string" &&
    explicitAnchorPayloadRaw.label.trim().length > 0 &&
    typeof explicitAnchorPayloadRaw.summary === "string" &&
    explicitAnchorPayloadRaw.summary.trim().length > 0
      ? {
          href: explicitAnchorPayloadRaw.href,
          label: explicitAnchorPayloadRaw.label.trim(),
          summary: explicitAnchorPayloadRaw.summary.trim(),
        }
      : null;

  const roleGoal = buildRoleGoalCandidate({
    english,
    roleLabel: roleLabels[input.membershipRole],
    profileType: input.profileType,
    focusAreas,
  });
  const signalCandidate = buildSignalCandidate({
    english,
    pendingApprovalTask,
    suggestedAction,
    meeting: recentMeeting,
    opportunity: hotOpportunity,
  });
  const suggestionCandidate = buildSuggestionCandidate({
    english,
    pendingApprovalTask,
    suggestedAction,
    meeting: recentMeeting,
    opportunity: hotOpportunity,
    signalReady: signalCandidate.status === "done",
  });
  const reviewCandidate = buildReviewCandidate({
    english,
    pendingApprovalTask,
    suggestedAction,
    reviewedApprovalCount,
  });
  const followThroughCandidate = buildFollowThroughCandidate({
    english,
    executedAction,
    suggestedAction,
    pendingApprovalTask,
  });
  const memoryCandidate = buildMemoryCandidate({
    english,
    memoryFact: recentMemoryFact,
    commitment: recentCommitment,
    blocker: recentBlocker,
    hasFollowThrough: followThroughCandidate.status === "done",
  });
  const anchorCandidate = buildAnchorCandidate({
    english,
    memoryCandidate: memoryCandidate.candidate,
    signalCandidate: signalCandidate.candidate,
    reviewCandidate: reviewCandidate.candidate,
    explicitAnchor,
    hasMemory: memoryCandidate.status === "done",
  });

  return buildWorkspaceFirstLoopModel({
    english,
    roleGoal,
    firstSignal: signalCandidate.candidate
      ? {
          ...signalCandidate.candidate,
          status: signalCandidate.status,
        }
      : null,
    firstSuggestion: suggestionCandidate.candidate
      ? {
          ...suggestionCandidate.candidate,
          status: suggestionCandidate.status,
        }
      : null,
    reviewCheckpoint: reviewCandidate.candidate
      ? {
          ...reviewCandidate.candidate,
          status: reviewCandidate.status,
        }
      : null,
    followThrough: followThroughCandidate.candidate
      ? {
          ...followThroughCandidate.candidate,
          status: followThroughCandidate.status,
        }
      : null,
    memoryWriteBack: memoryCandidate.candidate
      ? {
          ...memoryCandidate.candidate,
          status: memoryCandidate.status,
        }
      : null,
    nextAnchor: anchorCandidate.candidate
      ? {
          ...anchorCandidate.candidate,
          status: anchorCandidate.status,
        }
      : null,
    hasExplicitAnchor: Boolean(explicitAnchor),
  });
}
