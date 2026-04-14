import type { CoachNode } from "@zone-blitz/shared";

/**
 * A coach in tree form: the flat `CoachNode` plus an ordered list of
 * direct reports. `reports` is always present, possibly empty.
 */
export interface StaffTreeNode extends CoachNode {
  reports: StaffTreeNode[];
}

/**
 * Canonical ordering for direct reports under a node — coordinators
 * first (OC, DC, STC), then offensive position coaches, then defensive,
 * then the special-teams assistant, with unknown roles trailing.
 */
const ROLE_ORDER: Record<string, number> = {
  HC: 0,
  OC: 1,
  DC: 2,
  STC: 3,
  QB: 4,
  RB: 5,
  WR: 6,
  TE: 7,
  OL: 8,
  DL: 9,
  LB: 10,
  DB: 11,
  ST_ASSISTANT: 12,
};

function compareByRole(a: CoachNode, b: CoachNode) {
  const aOrder = ROLE_ORDER[a.role] ?? 99;
  const bOrder = ROLE_ORDER[b.role] ?? 99;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.lastName.localeCompare(b.lastName);
}

/**
 * Builds the staff tree from the flat `CoachNode` list returned by the
 * API. Nodes with `reportsToId === null` become roots; a node whose
 * `reportsToId` does not resolve to any sibling is treated as a root so
 * the staff is never silently hidden. Children are sorted by canonical
 * role order.
 */
export function buildStaffTree(nodes: CoachNode[]): StaffTreeNode[] {
  const byId = new Map<string, StaffTreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, reports: [] });
  }

  const roots: StaffTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.reportsToId ? byId.get(node.reportsToId) : undefined;
    if (parent) {
      parent.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const node of byId.values()) {
    node.reports.sort(compareByRole);
  }
  roots.sort(compareByRole);

  return roots;
}
