import { describe, expect, it } from "vitest";
import {
  FULL_SHELL_CHROME,
  parseShellBrandLabel,
  parseShellChromeProfiles,
  resolveShellChrome,
} from "@/lib/shell/shell-chrome";

const config = (profiles: unknown) =>
  JSON.stringify({ shellChromeProfiles: profiles });

describe("parseShellChromeProfiles", () => {
  it("parses valid subtree profiles", () => {
    expect(
      parseShellChromeProfiles(
        config([
          { pathPrefix: "/tenant-os", sidebar: "hidden" },
          { pathPrefix: "/tenant-os/sub_area.v2", sidebar: "hidden" },
        ]),
      ),
    ).toEqual([
      { pathPrefix: "/tenant-os", sidebar: "hidden" },
      { pathPrefix: "/tenant-os/sub_area.v2", sidebar: "hidden" },
    ]);
  });

  it("returns empty for missing/invalid configuration", () => {
    expect(parseShellChromeProfiles(null)).toEqual([]);
    expect(parseShellChromeProfiles(undefined)).toEqual([]);
    expect(parseShellChromeProfiles("")).toEqual([]);
    expect(parseShellChromeProfiles("not-json")).toEqual([]);
    expect(parseShellChromeProfiles("[]")).toEqual([]);
    expect(parseShellChromeProfiles(JSON.stringify({}))).toEqual([]);
    expect(
      parseShellChromeProfiles(JSON.stringify({ shellChromeProfiles: "x" })),
    ).toEqual([]);
    // 运行时混入非字符串（越过类型系统）同样安全
    expect(parseShellChromeProfiles(12345 as never)).toEqual([]);
    expect(parseShellChromeProfiles({} as never)).toEqual([]);
  });

  it("is all-or-nothing: any invalid entry disables the whole declaration", () => {
    // 混合合法+非法 → 整组失效（非法配置不部分生效，蓝图 §3.3 严格失败语义）
    expect(
      parseShellChromeProfiles(
        config([
          { pathPrefix: "/ok", sidebar: "hidden" },
          { pathPrefix: "/", sidebar: "hidden" },
        ]),
      ),
    ).toEqual([]);
    for (const bad of [
      "/",
      "//evil",
      "https://x",
      "/a:b",
      "/a\\b",
      "/a?x=1",
      "/a#f",
      "/a/*",
      "relative",
      "/trail/",
      " /pad",
      "/pad ",
      "/a//b",
      "/a/../b",
      "/a/.",
      "/a%2Fb",
      "/a\u0000b",
      "/a b",
      `/${"x".repeat(300)}`,
    ]) {
      expect(
        parseShellChromeProfiles(
          config([
            { pathPrefix: bad, sidebar: "hidden" },
            { pathPrefix: "/ok", sidebar: "hidden" },
          ]),
        ),
      ).toEqual([]);
    }
    expect(
      parseShellChromeProfiles(
        config([{ pathPrefix: "/ok", sidebar: "shown" }]),
      ),
    ).toEqual([]);
    expect(parseShellChromeProfiles(config(["garbage"]))).toEqual([]);
    expect(parseShellChromeProfiles(config([null]))).toEqual([]);
  });

  it("rejects over-limit declarations and oversized raw configuration", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      pathPrefix: `/p${i}`,
      sidebar: "hidden",
    }));
    expect(parseShellChromeProfiles(config(many))).toEqual([]);
    const huge = JSON.stringify({
      padding: "x".repeat(25_000),
      shellChromeProfiles: [{ pathPrefix: "/ok", sidebar: "hidden" }],
    });
    expect(parseShellChromeProfiles(huge)).toEqual([]);
  });
});

describe("resolveShellChrome", () => {
  const profiles = [{ pathPrefix: "/tenant-os", sidebar: "hidden" as const }];

  it("hides sidebar inside the declared subtree only (segment boundary)", () => {
    expect(resolveShellChrome("/tenant-os", profiles).sidebar).toBe("hidden");
    expect(resolveShellChrome("/tenant-os/home", profiles).sidebar).toBe(
      "hidden",
    );
    expect(resolveShellChrome("/tenant-osx", profiles).sidebar).toBe("visible");
    expect(resolveShellChrome("/other", profiles).sidebar).toBe("visible");
    expect(resolveShellChrome("/", profiles).sidebar).toBe("visible");
  });

  it("matches case-sensitively (exact character contract)", () => {
    expect(resolveShellChrome("/Tenant-os", profiles).sidebar).toBe("visible");
    expect(resolveShellChrome("/TENANT-OS/home", profiles).sidebar).toBe(
      "visible",
    );
  });

  it("keeps topbar visible in all resolutions", () => {
    expect(resolveShellChrome("/tenant-os", profiles).topbar).toBe("visible");
    expect(resolveShellChrome("/other", profiles).topbar).toBe("visible");
  });

  it("fails open to full chrome on abnormal input", () => {
    expect(resolveShellChrome(null, profiles)).toEqual(FULL_SHELL_CHROME);
    expect(resolveShellChrome(undefined, profiles)).toEqual(FULL_SHELL_CHROME);
    expect(resolveShellChrome("no-leading-slash", profiles)).toEqual(
      FULL_SHELL_CHROME,
    );
    expect(resolveShellChrome("/tenant-os", [])).toEqual(FULL_SHELL_CHROME);
    // 运行期混入的非法 profile 条目同样不生效
    expect(
      resolveShellChrome("/tenant-os", [
        { pathPrefix: "tenant-os", sidebar: "hidden" },
      ] as never),
    ).toEqual(FULL_SHELL_CHROME);
  });

  it("exposes a frozen fallback resolution", () => {
    expect(Object.isFrozen(FULL_SHELL_CHROME)).toBe(true);
    expect(() => {
      (FULL_SHELL_CHROME as { sidebar: string }).sidebar = "hidden";
    }).toThrow();
    expect(FULL_SHELL_CHROME.sidebar).toBe("visible");
  });
});

describe("parseShellBrandLabel", () => {
  const cfg = (v: unknown) => JSON.stringify({ shellBrandLabel: v });

  it("returns the trimmed label for a valid declaration", () => {
    expect(parseShellBrandLabel(cfg("Anson Helm"))).toBe("Anson Helm");
    expect(parseShellBrandLabel(cfg("  Anson Helm  "))).toBe("Anson Helm");
  });

  it("fail-closed: undeclared / non-string / blank / overlong / multiline → null", () => {
    expect(parseShellBrandLabel(null)).toBeNull();
    expect(parseShellBrandLabel("")).toBeNull();
    expect(parseShellBrandLabel("{}")).toBeNull();
    expect(parseShellBrandLabel("not json")).toBeNull();
    expect(parseShellBrandLabel(cfg(42))).toBeNull();
    expect(parseShellBrandLabel(cfg("   "))).toBeNull();
    expect(parseShellBrandLabel(cfg("x".repeat(41)))).toBeNull();
    expect(parseShellBrandLabel(cfg("a\nb"))).toBeNull();
  });

  it("coexists with shellChromeProfiles in the same configuration payload", () => {
    const both = JSON.stringify({
      shellBrandLabel: "Anson Helm",
      shellChromeProfiles: [{ pathPrefix: "/x", sidebar: "hidden" }],
    });
    expect(parseShellBrandLabel(both)).toBe("Anson Helm");
    expect(parseShellChromeProfiles(both)).toEqual([{ pathPrefix: "/x", sidebar: "hidden" }]);
  });
});
