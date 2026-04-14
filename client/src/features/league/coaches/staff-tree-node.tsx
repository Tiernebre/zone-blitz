import { Link } from "@tanstack/react-router";
import type {
  CoachPlayCaller,
  CoachRole,
  CoachSpecialty,
} from "@zone-blitz/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StaffTreeNode as StaffTreeNodeData } from "./build-tree.ts";

const ROLE_LABELS: Record<CoachRole, string> = {
  HC: "Head Coach",
  OC: "Offensive Coordinator",
  DC: "Defensive Coordinator",
  STC: "Special Teams Coordinator",
  QB: "QB Coach",
  RB: "Running Backs Coach",
  WR: "Wide Receivers Coach",
  TE: "Tight Ends Coach",
  OL: "Offensive Line Coach",
  DL: "Defensive Line Coach",
  LB: "Linebackers Coach",
  DB: "Defensive Backs Coach",
  ST_ASSISTANT: "Special Teams Assistant",
};

const SPECIALTY_LABELS: Record<CoachSpecialty, string> = {
  offense: "offense",
  defense: "defense",
  special_teams: "special teams",
  quarterbacks: "quarterbacks",
  running_backs: "running backs",
  wide_receivers: "wide receivers",
  tight_ends: "tight ends",
  offensive_line: "offensive line",
  defensive_line: "defensive line",
  linebackers: "linebackers",
  defensive_backs: "defensive backs",
  ceo: "CEO",
};

const PLAY_CALLER_LABELS: Record<CoachPlayCaller, string> = {
  offense: "Calls offense",
  defense: "Calls defense",
  ceo: "CEO",
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
    <li className="flex flex-col gap-3" data-testid={`coach-${node.id}`}>
      <CoachCard node={node} leagueId={leagueId} />
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

function CoachCard({
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
        to="/leagues/$leagueId/coaches/$coachId"
        params={{ leagueId, coachId: node.id }}
        className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {node.firstName} {node.lastName}
          </p>
          {node.playCaller && (
            <Badge variant="secondary">
              {PLAY_CALLER_LABELS[node.playCaller]}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {ROLE_LABELS[node.role]}
          {node.specialty && (
            <span>· {SPECIALTY_LABELS[node.specialty]} background</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Age {node.age} · {node.yearsWithTeam} yr w/ team ·{" "}
          {node.contractYearsRemaining} yr remaining
        </p>
      </Link>
    </Card>
  );
}
