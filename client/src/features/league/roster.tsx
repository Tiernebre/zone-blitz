import { useParams } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SchemeFitBadge } from "@/components/ui/scheme-fit-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type {
  ActiveRoster,
  DepthChart,
  NeutralBucketGroup,
  RosterPlayer,
} from "@zone-blitz/shared/types/roster.ts";
import type { PlayerInjuryStatus } from "@zone-blitz/shared/types/player.ts";
import { useLeague } from "../../hooks/use-league.ts";
import { useActiveRoster } from "../../hooks/use-active-roster.ts";
import { useDepthChart } from "../../hooks/use-depth-chart.ts";

const groupLabels: Record<NeutralBucketGroup, string> = {
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special Teams",
};

const groupFilterOptions: (NeutralBucketGroup | "all")[] = [
  "all",
  "offense",
  "defense",
  "special_teams",
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
    accessorFn: (p) => `${p.firstName} ${p.lastName}`,
    header: ({ column }) => (
      <SortableHeader column={column}>Player</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.firstName} {row.original.lastName}
      </span>
    ),
  },
  {
    accessorKey: "depthChartSlot",
    header: ({ column }) => (
      <SortableHeader column={column}>
        Pos
      </SortableHeader>
    ),
    cell: ({ row }) => row.original.depthChartSlot ?? "—",
  },
  {
    accessorKey: "neutralBucketGroup",
    header: ({ column }) => (
      <SortableHeader column={column}>Group</SortableHeader>
    ),
    cell: ({ row }) => groupLabels[row.original.neutralBucketGroup],
    filterFn: (row: Row<RosterPlayer>, _id, value) =>
      value === "all" || row.original.neutralBucketGroup === value,
  },
  {
    accessorKey: "age",
    header: ({ column }) => (
      <SortableHeader column={column}>
        Age
      </SortableHeader>
    ),
  },
  {
    accessorKey: "schemeFit",
    header: ({ column }) => (
      <SortableHeader column={column}>Scheme Fit</SortableHeader>
    ),
    cell: ({ row }) => (
      <SchemeFitBadge
        fit={row.original.schemeFit}
        testId={`roster-scheme-fit-${row.original.id}`}
      />
    ),
  },
  {
    accessorKey: "injuryStatus",
    header: ({ column }) => (
      <SortableHeader column={column}>Status</SortableHeader>
    ),
    cell: ({ row }) => (
      <Badge variant={injuryBadgeVariant(row.original.injuryStatus)}>
        {formatInjury(row.original.injuryStatus)}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span>Actions</span>,
    cell: () => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled>
          Release
        </Button>
        <Button variant="ghost" size="sm" disabled>
          Trade
        </Button>
        <Button variant="ghost" size="sm" disabled>
          Restructure
        </Button>
      </div>
    ),
    enableSorting: false,
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
  return (
    <>
      <DataTable
        columns={rosterColumns}
        data={roster.players}
        getRowTestId={(player) => `roster-row-${player.id}`}
        toolbar={(table) => {
          const groupFilter =
            (table.getColumn("neutralBucketGroup")?.getFilterValue() as
              | NeutralBucketGroup
              | "all"
              | undefined) ?? "all";
          return (
            <div
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid="roster-toolbar"
            >
              <Input
                aria-label="Search roster"
                placeholder="Search players…"
                className="sm:max-w-xs"
                value={(table.getState().globalFilter as string) ?? ""}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
              />
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Filter by position group"
              >
                {groupFilterOptions.map((option) => {
                  const active = groupFilter === option;
                  return (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "ghost"}
                      data-testid={`roster-group-filter-${option}`}
                      aria-pressed={active}
                      onClick={() =>
                        table
                          .getColumn("neutralBucketGroup")
                          ?.setFilterValue(option)}
                    >
                      {option === "all" ? "All" : groupLabels[option]}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        }}
      />
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

  const bySlotCode = new Map<string, typeof chart.slots>();
  for (const slot of chart.slots) {
    const existing = bySlotCode.get(slot.slotCode) ?? [];
    existing.push(slot);
    bySlotCode.set(slot.slotCode, existing);
  }

  const vocabCodes = chart.vocabulary;

  return (
    <>
      <DepthChartMeta
        lastUpdatedAt={chart.lastUpdatedAt}
        lastUpdatedBy={chart.lastUpdatedBy}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vocabCodes.map((def) => {
          const slots = [...(bySlotCode.get(def.code) ?? [])].sort(
            (a, b) => a.slotOrdinal - b.slotOrdinal,
          );
          if (slots.length === 0 && !bySlotCode.has(def.code)) return null;
          return (
            <Card
              key={def.code}
              data-testid={`depth-chart-position-${def.code}`}
            >
              <CardHeader>
                <CardTitle>{def.code}</CardTitle>
                {def.label !== def.code && (
                  <CardDescription>{def.label}</CardDescription>
                )}
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
                    <TableCell>{player.slotCode}</TableCell>
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
