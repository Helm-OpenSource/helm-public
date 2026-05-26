import { RecordSource } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildInboxThreadWhere } from "@/features/inbox/queries";

describe("inbox thread visibility scope", () => {
  it("keeps non-mailbox threads visible and scopes aliyun mailbox threads to the current inbox account", () => {
    expect(buildInboxThreadWhere("ws_1", "Owner@Example.com")).toEqual({
      workspaceId: "ws_1",
      OR: [
        {
          source: {
            not: RecordSource.GMAIL,
          },
        },
        {
          source: RecordSource.GMAIL,
          participants: {
            contains: "owner@example.com",
          },
        },
      ],
    });
  });

  it("hides aliyun mailbox threads when the current user has not connected a personal mailbox", () => {
    expect(buildInboxThreadWhere("ws_1", null)).toEqual({
      workspaceId: "ws_1",
      source: {
        not: RecordSource.GMAIL,
      },
    });
  });
});
