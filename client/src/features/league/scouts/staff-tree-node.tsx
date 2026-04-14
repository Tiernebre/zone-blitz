import { Link } from "@tanstack/react-router";
import type { ScoutRole } from "@zone-blitz/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StaffTreeNode as StaffTreeNodeData } from "./build-tree.ts";

const ROLE_LABELS: Record<ScoutRole, string> = {
  DIRECTOR: "Scouting Director",
  NATIONAL_CROSS_CHECKER: "National Cross-checker",
  AREA_SCOUT: "Area Scout",
};

interface StaffTreeNodeProps {
  node: StaffTreeNodeData;
  leagueId: string;
  depth?: number;
}

export function StaffTreeNode(
  { node, leagueId, depth = 0 }: StaffTreeNodeProps,
) {
  return (
    <li className="flex flex-col gap-3" data-testid={`scout-${node.id}`}>
      <ScoutCard node={node} leagueId={leagueId} />
      {node.reports.length > 0 && (
        <ul className="flex flex-col gap-3 border-l border-border pl-6 ml-4">
          {node.reports.map((child) => (
            <StaffTreeNode
              key={child.id}
              node={child}
              leagueId={leagueId}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function ScoutCard({
  node,
  leagueId,
}: {
  node: StaffTreeNodeData;
  leagueId: string;
}) {
  if (node.isVacancy) {
    return (
      <Card className="flex flex-row items-center justify-between gap-4 border-dashed bg-muted/30 p-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {ROLE_LABELS[node.role]}
          </p>
          <p className="text-xs text-muted-foreground">Vacant</p>
        </div>
        <Button size="sm" variant="outline" disabled>
          Hire
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <Link
        to="/leagues/$leagueId/scouts/$scoutId"
        params={{ leagueId, scoutId: node.id }}
        className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {node.firstName} {node.lastName}
          </p>
          <Badge variant="secondary">
            {node.workCapacity} pts / cycle
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {ROLE_LABELS[node.role]}
          {node.coverage && <span>· {node.coverage}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          Age {node.age} · {node.yearsWithTeam} yr w/ team ·{" "}
          {node.contractYearsRemaining} yr remaining
        </p>
      </Link>
    </Card>
  );
}
