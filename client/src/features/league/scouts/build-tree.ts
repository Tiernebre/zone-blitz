import type { ScoutNode } from "@zone-blitz/shared";

/**
 * A scout in tree form: the flat `ScoutNode` plus an ordered list of
 * direct reports. `reports` is always present, possibly empty.
 */
export interface StaffTreeNode extends ScoutNode {
  reports: StaffTreeNode[];
}

const ROLE_ORDER: Record<string, number> = {
  DIRECTOR: 0,
  NATIONAL_CROSS_CHECKER: 1,
  AREA_SCOUT: 2,
};

function compareByRole(a: ScoutNode, b: ScoutNode) {
  const aOrder = ROLE_ORDER[a.role] ?? 99;
  const bOrder = ROLE_ORDER[b.role] ?? 99;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.lastName.localeCompare(b.lastName);
}

/**
 * Builds the staff tree from the flat `ScoutNode` list returned by the
 * API. Nodes with `reportsToId === null` become roots; a node whose
 * `reportsToId` does not resolve to any sibling is treated as a root so
 * the staff is never silently hidden. Children are sorted by canonical
 * role order (Director → National Cross-checker → Area Scout).
 */
export function buildStaffTree(nodes: ScoutNode[]): StaffTreeNode[] {
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
