import type { CoachNode, CoachRole } from "@zone-blitz/shared";
import { describe, expect, it } from "vitest";
import { buildStaffTree } from "./build-tree.ts";

function node(overrides: Partial<CoachNode> & { id: string }): CoachNode {
  return {
    id: overrides.id,
    firstName: overrides.firstName ?? "First",
    lastName: overrides.lastName ?? overrides.id,
    role: (overrides.role ?? "OC") as CoachRole,
    reportsToId: overrides.reportsToId ?? null,
    playCaller: overrides.playCaller ?? null,
    specialty: overrides.specialty ?? null,
    age: overrides.age ?? 45,
    yearsWithTeam: overrides.yearsWithTeam ?? 2,
    contractYearsRemaining: overrides.contractYearsRemaining ?? 2,
    isVacancy: overrides.isVacancy ?? false,
  };
}

describe("buildStaffTree", () => {
  it("returns an empty list when there are no coaches", () => {
    expect(buildStaffTree([])).toEqual([]);
  });

  it("roots the tree at the head coach", () => {
    const tree = buildStaffTree([
      node({ id: "hc", role: "HC" }),
      node({ id: "oc", role: "OC", reportsToId: "hc" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("hc");
    expect(tree[0].reports.map((r) => r.id)).toEqual(["oc"]);
  });

  it("nests position coaches under their coordinator three levels deep", () => {
    const tree = buildStaffTree([
      node({ id: "hc", role: "HC" }),
      node({ id: "oc", role: "OC", reportsToId: "hc" }),
      node({ id: "dc", role: "DC", reportsToId: "hc" }),
      node({ id: "qb", role: "QB", reportsToId: "oc" }),
      node({ id: "ol", role: "OL", reportsToId: "oc" }),
      node({ id: "db", role: "DB", reportsToId: "dc" }),
    ]);

    expect(tree).toHaveLength(1);
    const hc = tree[0];
    expect(hc.reports.map((r) => r.id)).toEqual(["oc", "dc"]);
    const oc = hc.reports.find((r) => r.id === "oc")!;
    expect(oc.reports.map((r) => r.id)).toEqual(["qb", "ol"]);
    const dc = hc.reports.find((r) => r.id === "dc")!;
    expect(dc.reports.map((r) => r.id)).toEqual(["db"]);
  });

  it("treats coaches whose reportsToId is missing as additional roots", () => {
    const tree = buildStaffTree([
      node({ id: "hc", role: "HC" }),
      node({ id: "orphan", role: "QB", reportsToId: "non-existent" }),
    ]);

    const rootIds = tree.map((r) => r.id).sort();
    expect(rootIds).toEqual(["hc", "orphan"]);
  });

  it("falls back to last-name ordering when two reports share a role", () => {
    const tree = buildStaffTree([
      node({ id: "hc", role: "HC" }),
      node({ id: "qb2", role: "QB", lastName: "Zebra", reportsToId: "hc" }),
      node({ id: "qb1", role: "QB", lastName: "Adams", reportsToId: "hc" }),
    ]);

    expect(tree[0].reports.map((r) => r.id)).toEqual(["qb1", "qb2"]);
  });

  it("places coaches with unknown roles after canonical roles", () => {
    const tree = buildStaffTree([
      node({ id: "hc", role: "HC" }),
      node({
        id: "unknown",
        role: "MYSTERY" as CoachRole,
        reportsToId: "hc",
      }),
      node({ id: "oc", role: "OC", reportsToId: "hc" }),
    ]);

    expect(tree[0].reports.map((r) => r.id)).toEqual(["oc", "unknown"]);
  });

  it("sorts direct reports by canonical role order", () => {
    const tree = buildStaffTree([
      node({ id: "hc", role: "HC" }),
      node({ id: "stc", role: "STC", reportsToId: "hc" }),
      node({ id: "oc", role: "OC", reportsToId: "hc" }),
      node({ id: "dc", role: "DC", reportsToId: "hc" }),
    ]);

    expect(tree[0].reports.map((r) => r.role)).toEqual(["OC", "DC", "STC"]);
  });
});
