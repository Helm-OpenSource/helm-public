import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetPackRegistryForTest, registerPackContributions } from "./registry-contract";
import { resolveImportsTopSections } from "./registry";

const workspace = {
  id: "workspace-import-slot-test",
  slug: "workspace-import-slot-test",
  systemKey: null,
  workspaceClass: null,
};

beforeEach(() => __resetPackRegistryForTest());
afterEach(() => {
  vi.restoreAllMocks();
  __resetPackRegistryForTest();
});

describe("Imports top-section extensions", () => {
  it("renders nothing when no extension contributes a section", async () => {
    const sections = await resolveImportsTopSections({ workspace, english: false });

    expect(sections).toEqual([]);
    expect(renderToStaticMarkup(createElement(Fragment, null, ...sections))).toBe("");
  });

  it("renders only authorized sections and passes the current membership context", async () => {
    const deniedRender = vi.fn(() => createElement("section", null, "denied"));
    const authorizedRender = vi.fn(({ english }: { workspace: typeof workspace; english: boolean }) =>
      createElement("section", { "data-testid": "extension-import" }, english ? "Import extension" : "导入扩展"),
    );
    let seenWorkspace: typeof workspace | undefined;
    let seenSubject: unknown;

    registerPackContributions("imports-slot-authorized-test", {
      importsTopSections: [
        {
          id: "denied",
          getAccess: async () => ({ ok: false }),
          render: deniedRender,
        },
        {
          id: "authorized",
          getAccess: async (currentWorkspace, context) => {
            seenWorkspace = currentWorkspace as typeof workspace;
            seenSubject = context?.subject;
            return { ok: true };
          },
          render: authorizedRender,
        },
      ],
    });

    const sections = await resolveImportsTopSections({
      workspace,
      english: false,
      membership: { id: "membership-1", workspaceId: workspace.id, role: "MEMBER", persona: "operator" },
    });

    expect(seenWorkspace).toEqual(workspace);
    expect(seenSubject).toMatchObject({
      actorType: "user",
      workspaceId: workspace.id,
      membershipId: "membership-1",
      workspaceRole: "MEMBER",
      persona: "operator",
    });
    expect(deniedRender).not.toHaveBeenCalled();
    expect(authorizedRender).toHaveBeenCalledWith({ workspace, english: false });
    expect(renderToStaticMarkup(createElement(Fragment, null, ...sections))).toContain(
      '<section data-testid="extension-import">导入扩展</section>',
    );
  });

  it("fails closed when an access probe throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerPackContributions("imports-slot-throw-test", {
      importsTopSections: [{
        id: "throwing",
        getAccess: async () => { throw new Error("access probe failed"); },
        render: () => createElement("section", null, "must not render"),
      }],
    });

    const sections = await resolveImportsTopSections({ workspace, english: false });

    expect(sections).toEqual([]);
  });
});
