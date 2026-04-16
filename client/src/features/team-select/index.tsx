import { useNavigate, useParams } from "@tanstack/react-router";
import { useAssignUserTeam } from "../../hooks/use-leagues.ts";
import { useLeagueTeams } from "../../hooks/use-teams.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TeamLogo } from "../../components/team-logo.tsx";

interface FranchiseTeam {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

function FranchiseCard({
  team,
  onSelect,
}: {
  team: FranchiseTeam;
  onSelect: (team: FranchiseTeam) => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(team)}
      className="h-auto p-0 w-full"
    >
      <Card className="w-full overflow-hidden transition-shadow hover:shadow-lg">
        <div
          className="h-2"
          style={{
            background:
              `linear-gradient(to right, ${team.primaryColor}, ${team.secondaryColor})`,
          }}
        />
        <CardContent className="flex items-center gap-4 p-4">
          <TeamLogo team={team} className="size-12 text-base" decorative />
          <div className="min-w-0 text-left">
            <p className="text-base font-bold text-card-foreground truncate">
              {team.city}
            </p>
            <p
              className="text-lg font-extrabold tracking-tight truncate"
              style={{ color: team.primaryColor }}
            >
              {team.name}
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            <span
              className="size-4 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: team.primaryColor }}
            />
            <span
              className="size-4 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: team.secondaryColor }}
            />
            <span
              className="size-4 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: team.accentColor }}
            />
          </div>
        </CardContent>
      </Card>
    </Button>
  );
}

export function TeamSelect() {
  const { leagueId } = useParams({ strict: false });
  const { data: teams, isLoading, error } = useLeagueTeams(leagueId!);
  const assignUserTeam = useAssignUserTeam();
  const navigate = useNavigate();

  const handleSelect = (team: FranchiseTeam) => {
    assignUserTeam.mutate(
      { leagueId: leagueId!, userTeamId: team.id },
      {
        onSuccess: () => {
          navigate({
            to: "/leagues/$leagueId/generate",
            params: { leagueId: leagueId! },
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Skeleton className="h-9 w-64 mx-auto" />
            <Skeleton className="h-5 w-80 mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !teams) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load franchises</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Choose Your Franchise
          </h1>
          <p className="text-muted-foreground">
            Pick one of the eight founding franchises to lead.
          </p>
        </div>

        {assignUserTeam.isError && (
          <Alert variant="destructive">
            <AlertTitle>Failed to assign team</AlertTitle>
            <AlertDescription>
              {assignUserTeam.error?.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(teams as FranchiseTeam[]).map((team) => (
            <FranchiseCard
              key={team.id}
              team={team}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
