import type { ScoutNode, ScoutRole } from "@zone-blitz/shared";
import { describe, expect, it } from "vitest";
import { buildStaffTree } from "./build-tree.ts";

function node(overrides: Partial<ScoutNode> & { id: string }): ScoutNode {
  return {
    id: overrides.id,
    firstName: overrides.firstName ?? "First",
    lastName: overrides.lastName ?? overrides.id,
    role: (overrides.role ?? "AREA_SCOUT") as ScoutRole,
    reportsToId: overrides.reportsToId ?? null,
    coverage: overrides.coverage ?? null,
    age: overrides.age ?? 45,
    yearsWithTeam: overrides.yearsWithTeam ?? 2,
    contractYearsRemaining: overrides.contractYearsRemaining ?? 2,
    workCapacity: overrides.workCapacity ?? 120,
    isVacancy: overrides.isVacancy ?? false,
  };
}

describe("buildStaffTree", () => {
  it("returns an empty list when there are no scouts", () => {
    expect(buildStaffTree([])).toEqual([]);
  });

  it("roots the tree at the director", () => {
    const tree = buildStaffTree([
      node({ id: "dir", role: "DIRECTOR" }),
      node({ id: "cc", role: "NATIONAL_CROSS_CHECKER", reportsToId: "dir" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("dir");
    expect(tree[0].reports.map((r) => r.id)).toEqual(["cc"]);
  });

  it("nests area scouts under their cross-checker three levels deep", () => {
    const tree = buildStaffTree([
      node({ id: "dir", role: "DIRECTOR" }),
      node({ id: "east", role: "NATIONAL_CROSS_CHECKER", reportsToId: "dir" }),
      node({ id: "west", role: "NATIONAL_CROSS_CHECKER", reportsToId: "dir" }),
      node({ id: "ne", role: "AREA_SCOUT", reportsToId: "east" }),
      node({ id: "se", role: "AREA_SCOUT", reportsToId: "east" }),
      node({ id: "mw", role: "AREA_SCOUT", reportsToId: "west" }),
    ]);

    expect(tree).toHaveLength(1);
    const director = tree[0];
    expect(director.reports.map((r) => r.id).sort()).toEqual(["east", "west"]);
    const east = director.reports.find((r) => r.id === "east")!;
    expect(east.reports.map((r) => r.id).sort()).toEqual(["ne", "se"]);
    const west = director.reports.find((r) => r.id === "west")!;
    expect(west.reports.map((r) => r.id)).toEqual(["mw"]);
  });

  it("treats scouts whose reportsToId is missing as additional roots", () => {
    const tree = buildStaffTree([
      node({ id: "dir", role: "DIRECTOR" }),
      node({
        id: "orphan",
        role: "AREA_SCOUT",
        reportsToId: "non-existent",
      }),
    ]);

    const rootIds = tree.map((r) => r.id).sort();
    expect(rootIds).toEqual(["dir", "orphan"]);
  });

  it("sorts direct reports by canonical role order", () => {
    const tree = buildStaffTree([
      node({ id: "dir", role: "DIRECTOR" }),
      node({ id: "area", role: "AREA_SCOUT", reportsToId: "dir" }),
      node({ id: "cc", role: "NATIONAL_CROSS_CHECKER", reportsToId: "dir" }),
    ]);

    expect(tree[0].reports.map((r) => r.role)).toEqual([
      "NATIONAL_CROSS_CHECKER",
      "AREA_SCOUT",
    ]);
  });
});
