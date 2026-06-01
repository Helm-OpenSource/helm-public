/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { BriefcaseBusiness, CheckSquare, Compass, MemoryStick } from "lucide-react";
import { describe, expect, it } from "vitest";
import { MobileCommandFooter } from "./mobile-command-footer";

describe("MobileCommandFooter", () => {
  it("renders bounded mobile work destinations without execution actions", () => {
    render(
      <MobileCommandFooter
        items={[
          { href: "/mobile", label: "Now", icon: <Compass />, active: true },
          { href: "/approvals", label: "Review", icon: <CheckSquare /> },
          { href: "/memory", label: "Memory", icon: <MemoryStick /> },
          { href: "/operating", label: "Operate", icon: <BriefcaseBusiness /> },
        ]}
        english
      />,
    );

    expect(screen.getByRole("navigation", { name: "Mobile command navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Now/ })).toHaveAttribute("href", "/mobile");
    expect(screen.getByRole("link", { name: /Review/ })).toHaveAttribute("href", "/approvals");
    expect(screen.getByRole("link", { name: /Memory/ })).toHaveAttribute("href", "/memory");
    expect(screen.getByRole("link", { name: /Operate/ })).toHaveAttribute("href", "/operating");
    expect(screen.queryByText(/send|approve|execute/i)).not.toBeInTheDocument();
  });
});
