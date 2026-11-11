// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

describe("SelectContent long option lists", () => {
  it("bounds the popup by Radix's available height and keeps every option reachable", async () => {
    const options = Array.from({ length: 200 }, (_, index) => `Synthetic case ${index + 1}`);
    render(
      <Select>
        <SelectTrigger aria-label="Synthetic long list"><SelectValue placeholder="Choose an option" /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>,
    );

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Synthetic long list" }), { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(200));
    expect(listbox.className).toContain("max-h-[var(--radix-select-content-available-height)]");

    const lastOption = await screen.findByRole("option", { name: "Synthetic case 200" });
    fireEvent.keyDown(listbox, { key: "End" });
    await waitFor(() => expect(lastOption.hasAttribute("data-highlighted")).toBe(true));
    fireEvent.keyDown(listbox, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });
});
