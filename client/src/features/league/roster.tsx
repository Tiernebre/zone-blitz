import { useParams } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PlayerPositionGroup,
  RosterPlayer,
  RosterPositionGroupSummary,
} from "@zone-blitz/shared/types/roster.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { useActiveRoster } from "../../hooks/use-active-roster.ts";

const groupLabels: Record<PlayerPositionGroup, string> = {
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special Teams",
};

const groupOrder: PlayerPositionGroup[] = [
  "offense",
  "defense",
  "special_teams",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currency.format(value);
}

function injuryBadgeVariant(
  status: RosterPlayer["injuryStatus"],
): "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "secondary";
  if (status === "out" || status === "ir") return "destructive";
  return "outline";
}

function formatInjury(status: RosterPlayer["injuryStatus"]) {
  return status.replace(/_/g, " ");
}

export function Roster() {
  const { leagueId } = useParams({ strict: false }) as { leagueId: string };
  const { data: league } = useLeague(leagueId);
  const teamId = league?.userTeamId ?? null;
  const {
    data: roster,
    isLoading,
    isError,
  } = useActiveRoster(leagueId, teamId);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Roster</h1>
        <p className="max-w-2xl text-muted-foreground">
          The 53-man active roster. You control who's on the team; the coaching
          staff sets the depth chart.
        </p>
      </div>

      {!teamId
        ? (
          <p className="text-muted-foreground">
            Select a team for this league to view its roster.
          </p>
        )
        : isLoading
        ? <RosterLoading />
        : isError || !roster
        ? (
          <p className="text-destructive">
            Failed to load roster. Try again in a moment.
          </p>
        )
        : <RosterContent roster={roster} />}
    </div>
  );
}

function RosterLoading() {
  return (
    <div data-testid="roster-loading" className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function RosterContent({
  roster,
}: {
  roster: {
    players: RosterPlayer[];
    positionGroups: RosterPositionGroupSummary[];
    totalCap: number;
    salaryCap: number;
    capSpace: number;
  };
}) {
  const playersByGroup: Record<PlayerPositionGroup, RosterPlayer[]> = {
    offense: [],
    defense: [],
    special_teams: [],
  };
  for (const player of roster.players) {
    playersByGroup[player.positionGroup].push(player);
  }

  return (
    <>
      <Card data-testid="roster-cap-summary">
        <CardHeader>
          <CardTitle>Cap Summary</CardTitle>
          <CardDescription>
            Roster spend against the league salary cap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CapStat
              label="Total Cap"
              value={formatCurrency(roster.totalCap)}
            />
            <CapStat
              label="Salary Cap"
              value={formatCurrency(roster.salaryCap)}
            />
            <CapStat
              label="Cap Space"
              value={formatCurrency(roster.capSpace)}
            />
          </dl>
        </CardContent>
      </Card>

      {groupOrder.map((group) => {
        const summary = roster.positionGroups.find((g) => g.group === group);
        const players = playersByGroup[group];
        if (!summary || summary.headcount === 0) return null;
        return (
          <Card key={group} data-testid={`position-group-${group}`}>
            <CardHeader
              className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"
              data-testid={`position-group-header-${group}`}
            >
              <CardTitle>{groupLabels[group]}</CardTitle>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>
                  {summary.headcount}{" "}
                  {summary.headcount === 1 ? "player" : "players"}
                </span>
                <span>{formatCurrency(summary.totalCap)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Cap Hit</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow
                      key={player.id}
                      data-testid={`roster-row-${player.id}`}
                    >
                      <TableCell className="font-medium">
                        {player.firstName} {player.lastName}
                      </TableCell>
                      <TableCell>{player.position}</TableCell>
                      <TableCell>{player.age}</TableCell>
                      <TableCell>{formatCurrency(player.capHit)}</TableCell>
                      <TableCell>
                        {player.contractYearsRemaining} yrs
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={injuryBadgeVariant(player.injuryStatus)}
                        >
                          {formatInjury(player.injuryStatus)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function CapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
