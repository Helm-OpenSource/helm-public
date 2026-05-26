import { describe, expect, it } from "vitest";

import { resolveDingTalkDirectoryInviteDetailUserId } from "@/lib/connectors/dingtalk-directory-invite-snapshot";
import type { DingTalkDirectoryInviteDetail } from "@/lib/connectors/dingtalk-directory-invite";

const details: DingTalkDirectoryInviteDetail[] = [
  {
    dingtalkUserId: "4360",
    unionId: "union-wanglizhen",
    name: "王丽珍",
    mobile: "13958044686",
    normalizedPhone: "+8613958044686",
    title: "策略运营",
    jobNumber: "4360",
    deptIds: [895695377],
    isLeader: false,
    placeholderEmail: "wanglizhen-zj@example.test",
    userResolution: "CREATED_PLACEHOLDER_EMAIL",
    membershipStatus: "INVITED_UPSERTED",
    messageStatus: "SENT",
    note: "task=3397534313940; unread=4360",
  },
  {
    dingtalkUserId: "3925",
    unionId: "union-lixiaofeng",
    name: "李小锋",
    mobile: "13900000000",
    normalizedPhone: "+8613900000000",
    title: "见习主管",
    jobNumber: "3925",
    deptIds: [867338477],
    isLeader: false,
    placeholderEmail: "lixiaofeng-zj@example.test",
    userResolution: "CREATED_PLACEHOLDER_EMAIL",
    membershipStatus: "INVITED_UPSERTED",
    messageStatus: "SENT",
    note: "task=3403187944039; unread=3925",
  },
];

describe("dingtalk directory invite snapshot resolver", () => {
  it("resolves a DingTalk userId by normalized phone", () => {
    expect(
      resolveDingTalkDirectoryInviteDetailUserId({
        details,
        name: "王丽珍",
        email: "wanglizhen@360amc.cn",
        phone: "+8613958044686",
      }),
    ).toBe("4360");
  });

  it("uses an exact unique name match when phone is not available", () => {
    expect(
      resolveDingTalkDirectoryInviteDetailUserId({
        details,
        name: "王丽珍",
        email: "wanglizhen@360amc.cn",
      }),
    ).toBe("4360");
  });
});
