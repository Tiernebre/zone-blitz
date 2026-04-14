import { useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import type {
  ActiveRoster,
  DepthChart,
  PlayerPositionGroup,
  RosterPlayer,
} from "@zone-blitz/shared/types/roster.ts";
import type { PlayerInjuryStatus } from "@zone-blitz/shared/types/player.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { useActiveRoster } from "../../hooks/use-active-roster.ts";
import { useDepthChart } from "../../hooks/use-depth-chart.ts";

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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCurrency(value: number) {
  return currency.format(value);
}

function injuryBadgeVariant(
  status: PlayerInjuryStatus,
): "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "secondary";
  if (status === "out" || status === "ir") return "destructive";
  return "outline";
}

function formatInjury(status: PlayerInjuryStatus) {
  return status.replace(/_/g, " ");
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatCoachRole(role: string) {
  return role
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const rosterColumns: ColumnDef<RosterPlayer>[] = [
  {
    id: "player",
    header: "Player",
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.firstName} {row.original.lastName}
      </span>
    ),
  },
  {
    accessorKey: "position",
    header: "Pos",
  },
  {
    accessorKey: "age",
    header: "Age",
  },
  {
    id: "capHit",
    header: "Cap Hit",
    cell: ({ row }) => formatCurrency(row.original.capHit),
  },
  {
    id: "contract",
    header: "Contract",
    cell: ({ row }) => `${row.original.contractYearsRemaining} yrs`,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={injuryBadgeVariant(row.original.injuryStatus)}>
        {formatInjury(row.original.injuryStatus)}
      </Badge>
    ),
  },
];

export function Roster() {
  const { leagueId } = useParams({ strict: false }) as { leagueId: string };
  const { data: league } = useLeague(leagueId);
  const teamId = league?.userTeamId ?? null;

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
        : (
          <Tabs defaultValue="active" className="gap-6">
            <TabsList>
              <TabsTrigger value="active">Active Roster</TabsTrigger>
              <TabsTrigger value="depth-chart">Depth Chart</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="flex flex-col gap-6">
              <ActiveRosterView leagueId={leagueId} teamId={teamId} />
            </TabsContent>
            <TabsContent value="depth-chart" className="flex flex-col gap-6">
              <DepthChartView leagueId={leagueId} teamId={teamId} />
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}

function ActiveRosterView(
  { leagueId, teamId }: { leagueId: string; teamId: string },
) {
  const { data: roster, isLoading, isError } = useActiveRoster(
    leagueId,
    teamId,
  );

  if (isLoading) {
    return (
      <div data-testid="active-roster-loading" className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !roster) {
    return (
      <p className="text-destructive">
        Failed to load roster. Try again in a moment.
      </p>
    );
  }
  return <ActiveRosterContent roster={roster} />;
}

function ActiveRosterContent({ roster }: { roster: ActiveRoster }) {
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
              <DataTable
                columns={rosterColumns}
                data={players}
                getRowTestId={(player) => `roster-row-${player.id}`}
              />
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function DepthChartView(
  { leagueId, teamId }: { leagueId: string; teamId: string },
) {
  const { data: chart, isLoading, isError } = useDepthChart(leagueId, teamId);

  if (isLoading) {
    return (
      <div data-testid="depth-chart-loading" className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !chart) {
    return (
      <p className="text-destructive">
        Failed to load depth chart. Try again in a moment.
      </p>
    );
  }
  return <DepthChartContent chart={chart} />;
}

function DepthChartContent({ chart }: { chart: DepthChart }) {
  if (chart.slots.length === 0 && chart.inactives.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>The coaching staff hasn't published a depth chart yet.</p>
          <p className="text-sm">
            Once the coach sets the chart, you'll see it here. You can't edit it
            — the coach owns the lineup.
          </p>
        </CardContent>
      </Card>
    );
  }

  const byPosition = new Map<string, typeof chart.slots>();
  for (const slot of chart.slots) {
    const existing = byPosition.get(slot.position) ?? [];
    existing.push(slot);
    byPosition.set(slot.position, existing);
  }
  const positions = [...byPosition.keys()].sort();

  return (
    <>
      <DepthChartMeta
        lastUpdatedAt={chart.lastUpdatedAt}
        lastUpdatedBy={chart.lastUpdatedBy}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {positions.map((position) => {
          const slots = [...byPosition.get(position)!].sort(
            (a, b) => a.slotOrdinal - b.slotOrdinal,
          );
          return (
            <Card
              key={position}
              data-testid={`depth-chart-position-${position}`}
            >
              <CardHeader>
                <CardTitle>{position}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {slots.map((slot) => (
                  <div
                    key={slot.playerId}
                    data-testid={`depth-chart-slot-${slot.playerId}`}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="w-8 text-sm font-semibold text-muted-foreground">
                        {ordinal(slot.slotOrdinal)}
                      </span>
                      <span className="font-medium">
                        {slot.firstName} {slot.lastName}
                      </span>
                    </div>
                    <Badge variant={injuryBadgeVariant(slot.injuryStatus)}>
                      {formatInjury(slot.injuryStatus)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {chart.inactives.length > 0 && (
        <Card data-testid="depth-chart-inactives">
          <CardHeader>
            <CardTitle>Game-Day Inactives</CardTitle>
            <CardDescription>
              Not dressing this week. Set by the coaching staff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chart.inactives.map((player) => (
                  <TableRow key={player.playerId}>
                    <TableCell className="font-medium">
                      {player.firstName} {player.lastName}
                    </TableCell>
                    <TableCell>{player.position}</TableCell>
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
      )}
    </>
  );
}

function DepthChartMeta(
  { lastUpdatedAt, lastUpdatedBy }: {
    lastUpdatedAt: DepthChart["lastUpdatedAt"];
    lastUpdatedBy: DepthChart["lastUpdatedBy"];
  },
) {
  const timestamp = lastUpdatedAt
    ? `Last updated ${dateFormatter.format(new Date(lastUpdatedAt))}`
    : null;
  const author = lastUpdatedBy
    ? `by ${lastUpdatedBy.firstName} ${lastUpdatedBy.lastName} (${
      formatCoachRole(lastUpdatedBy.role)
    })`
    : null;
  return (
    <p
      data-testid="depth-chart-meta"
      className="text-sm text-muted-foreground"
    >
      {[timestamp, author].filter(Boolean).join(" ")}
    </p>
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
