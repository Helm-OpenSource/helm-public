import { describe, expect, it } from "vitest";
import {
  formatOperatingReviewStatus,
  toOperatingReviewAction,
  type OperatingReviewActionSource,
} from "@/features/internal-operating-workspace/review-actions";

function source(
  actionItem: Partial<OperatingReviewActionSource["actionItem"]> = {},
  status: OperatingReviewActionSource["status"] = "PENDING",
): OperatingReviewActionSource {
  return {
    id: "approval-1",
    status,
    actionItem: {
      id: "action-1",
      title: "回复草稿：试点范围",
      opportunityId: null,
      opportunity: null,
      contact: null,
      meeting: null,
      createdBy: null,
      ...actionItem,
    },
  };
}

describe("toOperatingReviewAction", () => {
  it("links the opportunity, its company and the initiator", () => {
    const action = toOperatingReviewAction(
      source({
        opportunityId: "opp-1",
        opportunity: {
          id: "opp-1",
          title: "Acme 试点",
          company: { id: "co-1", name: "Acme" },
        },
        contact: { id: "contact-1", name: "Lin" },
        createdBy: { id: "user-1", name: "王敏" },
      }),
    );

    expect(action.href).toBe("/review-requests/approval-1");
    expect(action.object).toEqual({
      kind: "opportunity",
      label: "Acme 试点",
      href: "/opportunities?opportunityId=opp-1",
    });
    expect(action.company).toEqual({ name: "Acme", href: "/companies/co-1" });
    expect(action.initiator).toBe("王敏");
  });

  it("falls back to the contact, then the meeting, and opens the approval drawer", () => {
    const contactAction = toOperatingReviewAction(
      source({ contact: { id: "contact-1", name: "Lin" } }),
    );
    expect(contactAction.object).toEqual({
      kind: "contact",
      label: "Lin",
      href: "/contacts/contact-1",
    });
    expect(contactAction.href).toBe("/approvals?approvalId=approval-1#approval-preview");

    const meetingAction = toOperatingReviewAction(
      source({ meeting: { id: "meeting-1", title: "周会" } }),
    );
    expect(meetingAction.object).toEqual({
      kind: "meeting",
      label: "周会",
      href: "/meetings/meeting-1",
    });
  });

  it("keeps a missing object and initiator empty instead of inventing them", () => {
    const action = toOperatingReviewAction(source({ createdBy: { id: "u", name: "  " } }));

    expect(action.object).toBeNull();
    expect(action.company).toBeNull();
    expect(action.initiator).toBeNull();
  });
});

describe("formatOperatingReviewStatus", () => {
  it("labels every approval status in both languages", () => {
    expect(formatOperatingReviewStatus("PENDING", false)).toBe("待复核");
    expect(formatOperatingReviewStatus("EXECUTED", true)).toBe("Approved");
    expect(formatOperatingReviewStatus("REJECTED", false)).toBe("已拒绝");
    expect(formatOperatingReviewStatus("WITHDRAWN", true)).toBe("Withdrawn");
  });
});
