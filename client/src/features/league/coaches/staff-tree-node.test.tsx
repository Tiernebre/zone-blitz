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
    params?: { leagueId: string; coachId: string };
    className?: string;
  }) => (
    <a
      href={params
        ? `/leagues/${params.leagueId}/coaches/${params.coachId}`
        : "#"}
      className={className}
    >
      {children}
    </a>
  ),
}));

function treeNode(overrides: Partial<StaffTreeNodeData>): StaffTreeNodeData {
  return {
    id: "c1",
    firstName: "Alex",
    lastName: "Stone",
    role: "HC",
    reportsToId: null,
    playCaller: null,
    specialty: null,
    age: 50,
    yearsWithTeam: 3,
    contractYearsRemaining: 4,
    isVacancy: false,
    reports: [],
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("StaffTreeNode", () => {
  it("renders the coach's name, role, and bio line", () => {
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ role: "OC", specialty: "offense" })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText("Alex Stone")).toBeDefined();
    expect(screen.getByText(/Offensive Coordinator/)).toBeDefined();
    expect(screen.getByText(/offense background/)).toBeDefined();
    expect(
      screen.getByText(/Age 50 · 3 yr w\/ team · 4 yr remaining/),
    ).toBeDefined();
  });

  it("renders a play-caller badge for head coaches", () => {
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ role: "HC", playCaller: "offense" })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText(/Calls offense/)).toBeDefined();
  });

  it("links to the coach detail route", () => {
    render(
      <ul>
        <StaffTreeNode node={treeNode({ id: "abc" })} leagueId="42" />
      </ul>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/leagues/42/coaches/abc");
  });

  it("renders a vacancy card with a disabled Hire button", () => {
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ isVacancy: true, role: "OL" })}
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
      id: "oc",
      firstName: "Sam",
      lastName: "Rivers",
      role: "OC",
    });
    render(
      <ul>
        <StaffTreeNode
          node={treeNode({ role: "HC", reports: [child] })}
          leagueId="1"
        />
      </ul>,
    );
    expect(screen.getByText("Alex Stone")).toBeDefined();
    expect(screen.getByText("Sam Rivers")).toBeDefined();
  });
});
