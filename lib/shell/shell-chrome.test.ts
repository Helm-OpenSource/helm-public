import { describe, expect, it } from "vitest";
import {
  FULL_SHELL_CHROME,
  parseShellChromeProfiles,
  resolveShellChrome,
} from "@/lib/shell/shell-chrome";

const config = (profiles: unknown) =>
  JSON.stringify({ shellChromeProfiles: profiles });

describe("parseShellChromeProfiles", () => {
  it("parses a valid subtree profile", () => {
    expect(
      parseShellChromeProfiles(
        config([{ pathPrefix: "/tenant-os", sidebar: "hidden" }]),
      ),
    ).toEqual([{ pathPrefix: "/tenant-os", sidebar: "hidden" }]);
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
  });

  it("drops invalid entries fail-closed", () => {
    expect(
      parseShellChromeProfiles(
        config([
          { pathPrefix: "/", sidebar: "hidden" }, // 根前缀不允许（无全局隐藏）
          { pathPrefix: "//evil", sidebar: "hidden" },
          { pathPrefix: "https://x", sidebar: "hidden" },
          { pathPrefix: "/a:b", sidebar: "hidden" },
          { pathPrefix: "/a\\b", sidebar: "hidden" },
          { pathPrefix: "/a?x=1", sidebar: "hidden" },
          { pathPrefix: "/a#f", sidebar: "hidden" },
          { pathPrefix: "/a/*", sidebar: "hidden" },
          { pathPrefix: "relative", sidebar: "hidden" },
          { pathPrefix: "/trail/", sidebar: "hidden" },
          { pathPrefix: " /pad", sidebar: "hidden" },
          { pathPrefix: `/${"x".repeat(300)}`, sidebar: "hidden" },
          { pathPrefix: "/ok-but-wrong-mode", sidebar: "shown" },
          { pathPrefix: "/ok", sidebar: "hidden" },
          "garbage",
          null,
        ]),
      ),
    ).toEqual([{ pathPrefix: "/ok", sidebar: "hidden" }]);
  });

  it("caps the number of profiles", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      pathPrefix: `/p${i}`,
      sidebar: "hidden",
    }));
    expect(parseShellChromeProfiles(config(many))).toHaveLength(20);
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
});
