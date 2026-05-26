import { describe, expect, it } from "vitest";
import {
  buildAskHelmHref,
  buildSearchIntentHref,
  shouldRouteSearchQueryToAskHelm,
} from "@/features/search/ask-helm-entry-routing";

describe("Ask Helm entry routing", () => {
  it("routes natural-language business questions to Ask Helm", () => {
    expect(shouldRouteSearchQueryToAskHelm("今天先处理什么")).toBe(true);
    expect(shouldRouteSearchQueryToAskHelm("Why is this blocked?")).toBe(true);
    expect(buildSearchIntentHref("今天先处理什么")).toBe(
      "/search?q=%E4%BB%8A%E5%A4%A9%E5%85%88%E5%A4%84%E7%90%86%E4%BB%80%E4%B9%88&mode=ask",
    );
  });

  it("keeps short object lookups in normal search", () => {
    expect(shouldRouteSearchQueryToAskHelm("Atlas")).toBe(false);
    expect(shouldRouteSearchQueryToAskHelm("今天科技")).toBe(false);
    expect(shouldRouteSearchQueryToAskHelm("tommy@example.com")).toBe(false);
    expect(buildSearchIntentHref("Atlas")).toBe("/search?q=Atlas");
  });

  it("always builds an explicit Ask Helm command href when the user chooses Ask", () => {
    expect(buildAskHelmHref("Atlas")).toBe("/search?mode=ask&q=Atlas");
    expect(buildAskHelmHref("")).toBe("/search?mode=ask");
  });
});
