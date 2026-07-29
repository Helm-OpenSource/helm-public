import { describe, expect, it } from "vitest";

import {
  createInMemoryContextRuleStore,
  type DraftRuleInput,
} from "@/lib/caio-context-broker/rule-store.service";

const NOW = new Date("2026-07-29T10:00:00.000Z");
const OWNER = { actorRef: "user:owner", isOwnerOrAdmin: true };
const MEMBER = { actorRef: "user:member", isOwnerOrAdmin: false };

function draftInput(overrides: Partial<DraftRuleInput> = {}): DraftRuleInput {
  return {
    workspaceId: "ws-1",
    ruleKey: "block-vendor-notes",
    scopeKind: "workspace",
    scopeRef: null,
    ruleKind: "deny",
    pattern: { sourceProject: "vendor" },
    createdByRef: "user:a",
    ...overrides,
  };
}

describe("negative rule lifecycle", () => {
  it("creates drafts with incrementing versions per ruleKey", async () => {
    const store = createInMemoryContextRuleStore();
    const first = await store.createDraftRule(draftInput(), NOW);
    const second = await store.createDraftRule(draftInput(), NOW);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(first.status).toBe("draft");
    expect(first.publishedByRef).toBeNull();
    expect(await store.listPublishedRules({ workspaceId: "ws-1" })).toEqual(
      [],
    );
  });

  it("publishes a draft only for an OWNER/ADMIN actor", async () => {
    const store = createInMemoryContextRuleStore();
    const draft = await store.createDraftRule(draftInput(), NOW);
    await expect(
      store.publishRule({
        workspaceId: "ws-1",
        ruleId: draft.id,
        actor: MEMBER,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "caio_rule_forbidden" });

    const published = await store.publishRule({
      workspaceId: "ws-1",
      ruleId: draft.id,
      actor: OWNER,
      now: NOW,
    });
    expect(published.status).toBe("published");
    expect(published.publishedByRef).toBe(OWNER.actorRef);
    expect(published.publishedAt).toBe(NOW.toISOString());
    const listed = await store.listPublishedRules({ workspaceId: "ws-1" });
    expect(listed.map((rule) => rule.id)).toEqual([draft.id]);
  });

  it("publishing a new version supersedes the previous published version", async () => {
    const store = createInMemoryContextRuleStore();
    const v1 = await store.createDraftRule(draftInput(), NOW);
    await store.publishRule({
      workspaceId: "ws-1",
      ruleId: v1.id,
      actor: OWNER,
      now: NOW,
    });
    const v2 = await store.createDraftRule(draftInput(), NOW);
    const later = new Date(NOW.getTime() + 60_000);
    await store.publishRule({
      workspaceId: "ws-1",
      ruleId: v2.id,
      actor: OWNER,
      now: later,
    });

    const listed = await store.listPublishedRules({ workspaceId: "ws-1" });
    expect(listed.map((rule) => [rule.id, rule.version])).toEqual([
      [v2.id, 2],
    ]);
    const superseded = await store.getRule({
      workspaceId: "ws-1",
      ruleId: v1.id,
    });
    expect(superseded?.status).toBe("revoked");
    expect(superseded?.revokedAt).toBe(later.toISOString());
  });

  it("revokes only published rules and only for OWNER/ADMIN", async () => {
    const store = createInMemoryContextRuleStore();
    const draft = await store.createDraftRule(draftInput(), NOW);
    await expect(
      store.revokeRule({
        workspaceId: "ws-1",
        ruleId: draft.id,
        actor: OWNER,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "caio_rule_illegal_state" });

    await store.publishRule({
      workspaceId: "ws-1",
      ruleId: draft.id,
      actor: OWNER,
      now: NOW,
    });
    await expect(
      store.revokeRule({
        workspaceId: "ws-1",
        ruleId: draft.id,
        actor: MEMBER,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "caio_rule_forbidden" });

    const revoked = await store.revokeRule({
      workspaceId: "ws-1",
      ruleId: draft.id,
      actor: OWNER,
      now: NOW,
    });
    expect(revoked.status).toBe("revoked");
    expect(await store.listPublishedRules({ workspaceId: "ws-1" })).toEqual(
      [],
    );
  });

  it("rejects publishing a rule from another workspace or an already published rule", async () => {
    const store = createInMemoryContextRuleStore();
    const draft = await store.createDraftRule(draftInput(), NOW);
    await expect(
      store.publishRule({
        workspaceId: "ws-other",
        ruleId: draft.id,
        actor: OWNER,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "caio_rule_not_found" });
    await store.publishRule({
      workspaceId: "ws-1",
      ruleId: draft.id,
      actor: OWNER,
      now: NOW,
    });
    await expect(
      store.publishRule({
        workspaceId: "ws-1",
        ruleId: draft.id,
        actor: OWNER,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "caio_rule_illegal_state" });
  });
});

describe("audit suggestions can only be drafts", () => {
  it("suggestRuleFromAudit always lands as status draft", async () => {
    const store = createInMemoryContextRuleStore();
    const suggested = await store.suggestRuleFromAudit(
      {
        ...draftInput({ ruleKey: "audit-suggested" }),
        auditFindingRef: "audit:finding-42",
      },
      NOW,
    );
    expect(suggested.status).toBe("draft");
    expect(suggested.publishedByRef).toBeNull();
    expect(suggested.publishedAt).toBeNull();
    expect(await store.listPublishedRules({ workspaceId: "ws-1" })).toEqual(
      [],
    );
  });

  it("the suggestion path cannot smuggle in a published status", async () => {
    const store = createInMemoryContextRuleStore();
    await expect(
      store.suggestRuleFromAudit(
        {
          ...draftInput({ ruleKey: "audit-smuggle" }),
          auditFindingRef: "audit:finding-43",
          status: "published",
        } as never,
        NOW,
      ),
    ).rejects.toThrow();
    expect(await store.listPublishedRules({ workspaceId: "ws-1" })).toEqual(
      [],
    );
  });
});
