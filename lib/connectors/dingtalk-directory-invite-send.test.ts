import { afterEach, describe, expect, it, vi } from "vitest";
import { sendDingTalkInviteMessage } from "@/lib/connectors/dingtalk-directory-invite";

describe("sendDingTalkInviteMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats DingTalk invalid recipient hints as a send failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errcode: 0,
          errmsg: "ok",
          task_id: 123,
          send_result: {
            invalid_user_id_list: ["qinruihong"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      sendDingTalkInviteMessage({
        accessToken: "token",
        agentId: "100001",
        dingtalkUserId: "qinruihong",
        workspaceName: "Helm 中国团队",
        inviteUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
        roleLabel: "MEMBER",
        title: "风控策略专家",
      }),
    ).rejects.toThrow("invalid recipients");
  });

  it("keeps success posture when no invalid recipient hint is present", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            task_id: 456,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            result: {
              send_result: {
                unread_user_id_list: ["valid-user"],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(
      sendDingTalkInviteMessage({
        accessToken: "token",
        agentId: "100001",
        dingtalkUserId: "valid-user",
        workspaceName: "Helm 中国团队",
        inviteUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
        roleLabel: "MEMBER",
        title: "财务经理",
      }),
    ).resolves.toMatchObject({
      taskId: "456",
      unreadUserIds: ["valid-user"],
      failedUserIds: [],
      forbiddenUserIds: [],
      invalidUserIds: [],
      forbiddenReasons: [],
      deliveryNote: null,
    });
  });

  it("treats getsendresult blocked recipient as failure", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            task_id: 789,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            result: {
              send_result: {
                forbidden_user_id_list: ["blocked-user"],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(
      sendDingTalkInviteMessage({
        accessToken: "token",
        agentId: "100001",
        dingtalkUserId: "blocked-user",
        workspaceName: "Helm 中国团队",
        inviteUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
        roleLabel: "MEMBER",
        title: "财务经理",
      }),
    ).rejects.toThrow("recipient blocked");
  });

  it("treats forbidden_list duplicate-limit as blocked recipient", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            task_id: 800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            send_result: {
              forbidden_list: [
                {
                  code: "143206",
                  count: 1,
                  userid: "repeat-user",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(
      sendDingTalkInviteMessage({
        accessToken: "token",
        agentId: "100001",
        dingtalkUserId: "repeat-user",
        workspaceName: "Helm 中国团队",
        inviteUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
        roleLabel: "MEMBER",
        title: "财务经理",
      }),
    ).rejects.toThrow("forbidden_list");
  });

  it("marks empty send-result as pending instead of read/unread zero certainty", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            task_id: 801,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            send_result: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );

    await expect(
      sendDingTalkInviteMessage({
        accessToken: "token",
        agentId: "100001",
        dingtalkUserId: "pending-user",
        workspaceName: "Helm 中国团队",
        inviteUrl: "https://helm.example.com/api/public-auth/dingtalk/start",
        roleLabel: "MEMBER",
        title: "财务经理",
      }),
    ).resolves.toMatchObject({
      taskId: "801",
      readUserIds: [],
      unreadUserIds: [],
      failedUserIds: [],
      forbiddenUserIds: [],
      invalidUserIds: [],
      forbiddenReasons: [],
      deliveryNote: "result_pending_after_retry",
    });
  });
});
