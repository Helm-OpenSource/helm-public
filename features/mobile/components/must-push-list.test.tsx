/**
 * Tests for Must Push List Component
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MustPushItem } from "../types";
import { MustPushList } from "./must-push-list";

function item(input: Partial<MustPushItem> & Pick<MustPushItem, "id" | "type" | "severity" | "score">): MustPushItem {
  return {
    title: `${input.id} title`,
    reason: `${input.id} reason`,
    primaryAction: {
      label: "Open",
      href: `/${input.id}`,
      mode: "open_page",
    },
    boundaryNote: {
      type: "suggestion_not_commitment",
      message: "This is a suggestion, not a commitment.",
    },
    ...input,
  };
}

describe("MustPushList", () => {
  it("renders an empty state without action links", () => {
    render(<MustPushList items={[]} english />);

    expect(screen.getByText("No urgent items right now")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a critical overflow cue when folded items include a critical item", () => {
    render(
      <MustPushList
        items={[
          item({ id: "primary", type: "stalled_opportunity", severity: "critical", score: 90 }),
        ]}
        totalCount={3}
        foldedCount={2}
        hasCriticalFolded
        english
      />,
    );

    expect(screen.getByText("Must Push")).toBeInTheDocument();
    expect(screen.getByText("2 more items")).toHaveClass(
      "text-[color:var(--status-danger-text)]",
    );
  });
});
