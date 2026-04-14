import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffTreeNode as StaffTreeNodeData } from "./build-tree.ts";
import { StaffTreeNode } from "./staff-tree-node.tsx";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    className,
  }: {
    children: React.ReactNode;
    to?: string;
    params?: { leagueId: string; scoutId: string };
    className?: string;
  }) => (
    <a
      href={params
        ? `/leagues/${params.leagueId}/scouts/${params.scoutId}`
        : "#"}
      className={className}
    >
      {children}
    </a>
  ),
}));

function treeNode(overrides: Partial<StaffTreeNodeData>): StaffTreeNodeData {
  return {
    id: "s1",
    firstName: "Alex",
    lastName: "Stone",
    role: "DIRECTOR",
    reportsToId: null,
    coverage: null,
    age: 58,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    workCapacity: 200,
    isVacancy: false,
    reports: [],
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("StaffTreeNode", () => {
  it("renders the scout's name, role, coverage, and bio line", () => {
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ role: "AREA_SCOUT", coverage: "Southeast" })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText("Alex Stone")).toBeDefined();
    expect(screen.getByText(/Area Scout/)).toBeDefined();
    expect(screen.getByText(/Southeast/)).toBeDefined();
    expect(
      screen.getByText(/Age 58 · 3 yr w\/ team · 4 yr remaining/),
    ).toBeDefined();
  });

  it("renders the work-capacity badge", () => {
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ workCapacity: 180 })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText(/180 pts \/ cycle/)).toBeDefined();
  });

  it("links to the scout detail route", () => {
    render(
      <ul>
        <StaffTreeNode node={treeNode({ id: "abc" })} leagueId="42" />
      </ul>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/leagues/42/scouts/abc");
  });

  it("renders a vacancy card with a disabled Hire button", () => {
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ isVacancy: true, role: "AREA_SCOUT" })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText("Vacant")).toBeDefined();
    const button = screen.getByRole("button", { name: "Hire" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("recursively renders direct reports", () => {
    const child = treeNode({
      id: "cc",
      firstName: "Sam",
      lastName: "Rivers",
      role: "NATIONAL_CROSS_CHECKER",
    });
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ role: "DIRECTOR", reports: [child] })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText("Alex Stone")).toBeDefined();
    expect(screen.getByText("Sam Rivers")).toBeDefined();
  });
});
