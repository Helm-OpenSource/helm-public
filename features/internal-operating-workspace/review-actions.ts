import type { ApprovalStatus } from "@prisma/client";

/**
 * The review actions on /operating, read from the approval tasks the home
 * query already loads: what the action is, the object it acts on and who
 * started it. Nothing here is inferred; missing relations stay null.
 *
 * 今天业务页的复核动作：动作本身、作用对象和发起人，都来自首页已加载的审批任务；
 * 没有的关系保持为空，不做推断。
 */

export type OperatingReviewActionSource = {
  id: string;
  status: ApprovalStatus;
  actionItem: {
    id: string;
    title: string;
    opportunityId: string | null;
    opportunity: {
      id: string;
      title: string;
      company: { id: string; name: string } | null;
    } | null;
    contact: { id: string; name: string } | null;
    meeting: { id: string; title: string } | null;
    createdBy: { id: string; name: string } | null;
  };
};

export type OperatingReviewActionObject = {
  kind: "opportunity" | "contact" | "meeting";
  label: string;
  href: string;
};

export type OperatingReviewAction = {
  id: string;
  title: string;
  status: ApprovalStatus;
  href: string;
  object: OperatingReviewActionObject | null;
  company: { name: string; href: string } | null;
  initiator: string | null;
};

function resolveObject(
  actionItem: OperatingReviewActionSource["actionItem"],
): OperatingReviewActionObject | null {
  if (actionItem.opportunity) {
    return {
      kind: "opportunity",
      label: actionItem.opportunity.title,
      href: `/opportunities?opportunityId=${actionItem.opportunity.id}`,
    };
  }
  if (actionItem.contact) {
    return {
      kind: "contact",
      label: actionItem.contact.name,
      href: `/contacts/${actionItem.contact.id}`,
    };
  }
  if (actionItem.meeting) {
    return {
      kind: "meeting",
      label: actionItem.meeting.title,
      href: `/meetings/${actionItem.meeting.id}`,
    };
  }
  return null;
}

export function toOperatingReviewAction(
  approval: OperatingReviewActionSource,
): OperatingReviewAction {
  const { actionItem } = approval;
  const company = actionItem.opportunity?.company ?? null;

  return {
    id: approval.id,
    title: actionItem.title,
    status: approval.status,
    href:
      actionItem.opportunityId != null
        ? `/review-requests/${approval.id}`
        : `/approvals?approvalId=${approval.id}#approval-preview`,
    object: resolveObject(actionItem),
    company: company ? { name: company.name, href: `/companies/${company.id}` } : null,
    initiator: actionItem.createdBy?.name?.trim() || null,
  };
}

export function formatOperatingReviewStatus(status: ApprovalStatus, english: boolean) {
  switch (status) {
    case "PENDING":
      return english ? "Pending review" : "待复核";
    case "EXECUTED":
      return english ? "Approved" : "已通过";
    case "REJECTED":
      return english ? "Rejected" : "已拒绝";
    case "WITHDRAWN":
      return english ? "Withdrawn" : "已撤回";
    default:
      return status;
  }
}
