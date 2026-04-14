import { useParams } from "@tanstack/react-router";
import type { CoachNode } from "@zone-blitz/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffTree } from "../../../hooks/use-staff-tree.ts";
import { useTeams } from "../../../hooks/use-teams.ts";
import { buildStaffTree } from "./build-tree.ts";
import { StaffTreeNode } from "./staff-tree-node.tsx";

export function Coaches() {
  const { leagueId: rawLeagueId } = useParams({ strict: false });
  const leagueId = rawLeagueId ?? "";
  // TODO: wire a proper "current team" selection once persisted. For now
  // the staff tree renders the first team returned by the teams endpoint
  // so the page has data to render end-to-end.
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const teamId = (teams?.[0]?.id as string | undefined) ?? "";
  const { data, isLoading, error } = useStaffTree(leagueId, teamId);

  const loading = teamsLoading || isLoading;

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Coaches</h1>
        <p className="text-sm text-muted-foreground">
          Your coaching staff, coordinators, and position coaches.
        </p>
      </header>

      {loading && (
        <div className="flex flex-col gap-3" data-testid="coaches-skeleton">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-11/12" />
          <Skeleton className="h-20 w-10/12" />
        </div>
      )}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load coaching staff.</AlertDescription>
        </Alert>
      )}

      {!loading && !error && data && (
        <StaffTree
          nodes={data as CoachNode[]}
          leagueId={leagueId}
        />
      )}
    </div>
  );
}

function StaffTree({
  nodes,
  leagueId,
}: {
  nodes: CoachNode[];
  leagueId: string;
}) {
  const tree = buildStaffTree(nodes);
  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No coaches on staff yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {tree.map((root) => (
        <StaffTreeNode key={root.id} node={root} leagueId={leagueId} />
      ))}
    </ul>
  );
}
