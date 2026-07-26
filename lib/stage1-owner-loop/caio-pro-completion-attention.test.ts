import { describe, expect, it } from "vitest";

import { validateAttentionItems } from "@/lib/shell/attention-feed";
import {
  CAIO_PRO_V1_COMPLETION_ITEMS,
  type CaioProV1CompletionItemKey,
} from "@/lib/stage1-owner-loop/caio-pro-completion";
import {
  CAIO_PRO_V1_DECISION_ITEM_KEYS,
  buildCaioProV1CompletionAttention,
} from "@/lib/stage1-owner-loop/caio-pro-completion-attention";

const HASH = `sha256:${"a".repeat(64)}`;

describe("caio pro v1 completion attention source", () => {
  it("gives the OWNER scope the full accountable TODO list, conformant", () => {
    const items = buildCaioProV1CompletionAttention({
      missingItemKeys: [...CAIO_PRO_V1_COMPLETION_ITEMS],
      assessmentContentHash: HASH,
      viewerRoleCategory: "OWNER",
      viewerHasOwnerScope: true,
    });
    expect(items).toHaveLength(CAIO_PRO_V1_COMPLETION_ITEMS.length);
    // every emitted item passes the shared attention conformance rules
    expect(validateAttentionItems(items)).toEqual([]);
    for (const item of items) {
      expect(item.severity).toBe("critical");
      expect(item.roleCategory).toBe("OWNER");
      expect(item.href).toBe("/dashboard#caio-pro-v1-completion");
      expect(item.basisRef).toBe(HASH);
    }
  });

  it("routes only the operational subset to the fde workstation", () => {
    const items = buildCaioProV1CompletionAttention({
      missingItemKeys: [...CAIO_PRO_V1_COMPLETION_ITEMS],
      assessmentContentHash: HASH,
      viewerRoleCategory: "fde",
      viewerHasOwnerScope: false,
    });
    const keys = items.map((item) => item.key);
    for (const decision of CAIO_PRO_V1_DECISION_ITEM_KEYS) {
      expect(keys).not.toContain(`caio-pro-v1-completion:${decision}`);
    }
    expect(items).toHaveLength(
      CAIO_PRO_V1_COMPLETION_ITEMS.length -
        CAIO_PRO_V1_DECISION_ITEM_KEYS.length,
    );
    expect(validateAttentionItems(items)).toEqual([]);
  });

  it("emits nothing for other roles and for a complete gate", () => {
    expect(
      buildCaioProV1CompletionAttention({
        missingItemKeys: [...CAIO_PRO_V1_COMPLETION_ITEMS],
        assessmentContentHash: HASH,
        viewerRoleCategory: "collections-agent",
        viewerHasOwnerScope: false,
      }),
    ).toEqual([]);
    expect(
      buildCaioProV1CompletionAttention({
        missingItemKeys: [],
        assessmentContentHash: HASH,
        viewerRoleCategory: "OWNER",
        viewerHasOwnerScope: true,
      }),
    ).toEqual([]);
  });

  it("drops unknown item keys instead of inventing labels", () => {
    const items = buildCaioProV1CompletionAttention({
      missingItemKeys: [
        "p5_g0_accepted",
        "not_a_real_item" as CaioProV1CompletionItemKey,
      ],
      assessmentContentHash: HASH,
      viewerRoleCategory: "OWNER",
      viewerHasOwnerScope: true,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.key).toBe("caio-pro-v1-completion:p5_g0_accepted");
  });
});
