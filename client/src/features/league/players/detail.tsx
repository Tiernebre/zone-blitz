import { Link, useParams } from "@tanstack/react-router";
import type { PlayerDetail as PlayerDetailData } from "@zone-blitz/shared";
import type {
  ContractHistoryEntry,
  ContractTerminationReason,
  PlayerAccoladeEntry,
  PlayerAccoladeType,
  PlayerInjuryStatus,
  PlayerSeasonStatRow,
  PlayerStatus,
  PlayerTransactionEntry,
  PlayerTransactionType,
} from "@zone-blitz/shared/types/player.ts";
import {
  computeCareerTotals,
  statColumnsForBucket,
} from "./career-stats-utils.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePlayerDetail } from "../../../hooks/use-player-detail.ts";
import { UserIcon } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currency.format(value);
}

const terminationLabels: Record<ContractTerminationReason, string> = {
  active: "Active",
  expired: "Expired",
  released: "Released",
  traded: "Traded",
  extended: "Extended",
  restructured: "Restructured",
};

const transactionLabels: Record<PlayerTransactionType, string> = {
  drafted: "Drafted",
  signed: "Signed",
  released: "Released",
  traded: "Traded",
  extended: "Extended",
  franchise_tagged: "Franchise tagged",
};

const accoladeLabels: Record<PlayerAccoladeType, string> = {
  pro_bowl: "Pro Bowl",
  all_pro_first: "All-Pro (1st team)",
  all_pro_second: "All-Pro (2nd team)",
  championship: "Championship",
  mvp: "MVP",
  offensive_player_of_the_year: "Offensive Player of the Year",
  defensive_player_of_the_year: "Defensive Player of the Year",
  offensive_rookie_of_the_year: "Offensive Rookie of the Year",
  defensive_rookie_of_the_year: "Defensive Rookie of the Year",
  comeback_player_of_the_year: "Comeback Player of the Year",
  statistical_milestone: "Milestone",
  other: "Honor",
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatStatValue(value: number | string): string {
  if (typeof value === "number") return numberFormatter.format(value);
  return value;
}

function injuryBadgeVariant(
  status: PlayerInjuryStatus,
): "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "secondary";
  if (status === "out" || status === "ir") return "destructive";
  return "outline";
}

function formatInjury(status: PlayerInjuryStatus) {
  return status.replace(/_/g, " ").toUpperCase();
}

function formatHeight(inches: number) {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${feet}'${remainder}"`;
}

function statusLabel(
  status: PlayerStatus,
  injuryStatus: PlayerInjuryStatus,
  hasTeam: boolean,
): string {
  if (status === "retired") return "Retired";
  if (status === "prospect") return "Prospect";
  if (injuryStatus === "ir") return "IR";
  if (!hasTeam) return "Free Agent";
  return "Active";
}

function statusBadgeVariant(
  status: PlayerStatus,
  injuryStatus: PlayerInjuryStatus,
  hasTeam: boolean,
): "secondary" | "destructive" | "outline" {
  if (status === "retired") return "outline";
  if (injuryStatus === "ir") return "destructive";
  if (!hasTeam) return "outline";
  return "secondary";
}

function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

export function PlayerDetail() {
  const { playerId, leagueId } = useParams({ strict: false }) as {
    playerId: string;
    leagueId: string;
  };
  const { data, isLoading, error } = usePlayerDetail(playerId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6" data-testid="player-skeleton">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load player detail.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const detail = data as PlayerDetailData;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PlayerBreadcrumb detail={detail} leagueId={leagueId} />
      <Header detail={detail} leagueId={leagueId} />
      <ContractSection detail={detail} leagueId={leagueId} />
      <TransactionsSection detail={detail} leagueId={leagueId} />
      <CareerLogSection detail={detail} leagueId={leagueId} />
      <AccoladesSection detail={detail} />
      <PreDraft detail={detail} />
    </div>
  );
}

function PlayerBreadcrumb(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  const playerName = `${detail.firstName} ${detail.lastName}`;

  if (detail.status === "prospect" && detail.preDraftEvaluation) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link
                  to="/leagues/$leagueId/draft"
                  params={{ leagueId }}
                />
              }
            >
              Draft {detail.preDraftEvaluation.draftClassYear}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{playerName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (!detail.currentTeam) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link
                  to="/leagues/$leagueId/free-agency"
                  params={{ leagueId }}
                />
              }
            >
              Free Agents
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{playerName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <Link
                to="/leagues/$leagueId/opponents/$teamId"
                params={{ leagueId, teamId: detail.currentTeam.id }}
              />
            }
          >
            {detail.currentTeam.city} {detail.currentTeam.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <Link
                to="/leagues/$leagueId/roster"
                params={{ leagueId }}
              />
            }
          >
            Roster
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{playerName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function Header(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  const proBowlCount = detail.accolades.filter(
    (a) => a.type === "pro_bowl",
  ).length;
  const allProCount = detail.accolades.filter(
    (a) => a.type === "all_pro_first" || a.type === "all_pro_second",
  ).length;
  const displayStatus = statusLabel(
    detail.status,
    detail.injuryStatus,
    detail.currentTeam !== null,
  );
  const badgeVariant = statusBadgeVariant(
    detail.status,
    detail.injuryStatus,
    detail.currentTeam !== null,
  );

  return (
    <header className="flex gap-5" data-testid="player-header">
      <div
        className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted"
        data-testid="player-headshot"
      >
        <UserIcon className="size-12 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {detail.jerseyNumber !== null && (
              <span className="text-muted-foreground">
                #{detail.jerseyNumber}
              </span>
            )}
            {detail.firstName} {detail.lastName}
          </h1>
          <Badge variant={badgeVariant}>{displayStatus}</Badge>
          {detail.injuryStatus !== "healthy" && (
            <Badge variant={injuryBadgeVariant(detail.injuryStatus)}>
              {formatInjury(detail.injuryStatus)}
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {detail.neutralBucket}
          {detail.currentTeam
            ? (
              <>
                {" · "}
                <Link
                  to="/leagues/$leagueId/opponents/$teamId"
                  params={{ leagueId, teamId: detail.currentTeam.id }}
                  className="font-medium underline-offset-2 hover:underline"
                  data-testid="player-current-team-link"
                >
                  {detail.currentTeam.city} {detail.currentTeam.name}
                </Link>
              </>
            )
            : <span>· Free Agent</span>}
        </p>

        <p className="text-sm text-muted-foreground">
          {formatHeight(detail.heightInches)} · {detail.weightPounds} lbs
        </p>

        <p className="text-sm text-muted-foreground">
          Age {detail.age} ({formatBirthDate(detail.birthDate)})
          {detail.origin.hometown && <>· {detail.origin.hometown}</>}
          {detail.origin.college && <>· {detail.origin.college}</>}
        </p>

        <p className="text-sm text-muted-foreground">
          {detail.yearsOfExperience} yr exp
          {detail.origin.draftYear !== null
            ? (
              <>
                {" · "}
                {detail.origin.draftYear} Rd {detail.origin.draftRound} Pick
                {" "}
                {detail.origin.draftPick}
                {detail.origin.draftingTeam && (
                  <>({detail.origin.draftingTeam.abbreviation})</>
                )}
              </>
            )
            : <>· Undrafted</>}
          {proBowlCount > 0 && <>· {proBowlCount}× Pro Bowl</>}
          {allProCount > 0 && <>· {allProCount}× All-Pro</>}
        </p>
      </div>
    </header>
  );
}

function Section(
  { title, children }: { title: string; children: React.ReactNode },
) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Separator className="flex-1" />
      </div>
      {children}
    </section>
  );
}

function ContractSection(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  const { currentContract, contractHistory } = detail;
  return (
    <Section title="Contract">
      {currentContract
        ? (
          <Card data-testid="player-current-contract">
            <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-4">
              <Fact label="Years">
                {currentContract.yearsRemaining}/{currentContract.totalYears}
              </Fact>
              <Fact label="Cap hit">
                {formatCurrency(currentContract.annualSalary)}
              </Fact>
              <Fact label="Total value">
                {formatCurrency(currentContract.totalSalary)}
              </Fact>
              <Fact label="Guaranteed">
                {formatCurrency(currentContract.guaranteedMoney)}
              </Fact>
            </CardContent>
          </Card>
        )
        : (
          <p
            className="text-sm text-muted-foreground"
            data-testid="player-no-current-contract"
          >
            Not under contract.
          </p>
        )}

      <ContractHistoryTable entries={contractHistory} leagueId={leagueId} />
    </Section>
  );
}

function Fact(
  { label, children }: { label: string; children: React.ReactNode },
) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function PreDraft({ detail }: { detail: PlayerDetailData }) {
  const evaluation = detail.preDraftEvaluation;
  if (!evaluation) return null;
  return (
    <Section title="Pre-draft evaluation">
      <Card data-testid="player-pre-draft">
        <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <Fact label="Draft class">
            <span data-testid="player-pre-draft-class">
              {evaluation.draftClassYear}
            </span>
          </Fact>
          <Fact label="Projected round">
            {evaluation.projectedRound !== null
              ? (
                <span data-testid="player-pre-draft-projection">
                  Round {evaluation.projectedRound}
                </span>
              )
              : <span className="text-muted-foreground">Unprojected</span>}
          </Fact>
          {evaluation.scoutingNotes && (
            <div className="sm:col-span-2">
              <Fact label="Scouting notes">
                <span
                  className="whitespace-pre-line"
                  data-testid="player-pre-draft-notes"
                >
                  {evaluation.scoutingNotes}
                </span>
              </Fact>
            </div>
          )}
        </CardContent>
      </Card>
    </Section>
  );
}

function ContractHistoryTable(
  { entries, leagueId }: {
    entries: ContractHistoryEntry[];
    leagueId: string;
  },
) {
  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="player-contract-history-empty"
      >
        No contract history on file.
      </p>
    );
  }
  return (
    <Card data-testid="player-contract-history">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Deal history
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signed</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Years</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Guaranteed</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                data-testid={`player-contract-history-row-${entry.id}`}
              >
                <TableCell>{entry.signedInYear}</TableCell>
                <TableCell>
                  <Link
                    to="/leagues/$leagueId/opponents/$teamId"
                    params={{ leagueId, teamId: entry.team.id }}
                    className="underline-offset-2 hover:underline"
                  >
                    {entry.team.abbreviation}
                  </Link>
                </TableCell>
                <TableCell>{entry.totalYears}</TableCell>
                <TableCell>{formatCurrency(entry.totalSalary)}</TableCell>
                <TableCell>{formatCurrency(entry.guaranteedMoney)}</TableCell>
                <TableCell>
                  {terminationLabels[entry.terminationReason]}
                  {entry.endedInYear !== null && (
                    <span className="text-muted-foreground">
                      · {entry.endedInYear}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TransactionsSection(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  const entries = detail.transactions;
  return (
    <Section title="Transactions">
      {entries.length === 0
        ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="player-transactions-empty"
          >
            No transactions on record.
          </p>
        )
        : (
          <Card data-testid="player-transactions">
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TransactionRow
                      key={entry.id}
                      entry={entry}
                      leagueId={leagueId}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
    </Section>
  );
}

function TransactionRow(
  { entry, leagueId }: {
    entry: PlayerTransactionEntry;
    leagueId: string;
  },
) {
  return (
    <TableRow data-testid={`player-transaction-row-${entry.id}`}>
      <TableCell>{entry.seasonYear}</TableCell>
      <TableCell>{transactionLabels[entry.type]}</TableCell>
      <TableCell>
        {entry.team
          ? (
            <Link
              to="/leagues/$leagueId/opponents/$teamId"
              params={{ leagueId, teamId: entry.team.id }}
              className="underline-offset-2 hover:underline"
            >
              {entry.team.abbreviation}
            </Link>
          )
          : <span className="text-muted-foreground">—</span>}
        {entry.counterpartyTeam && (
          <>
            {" ↔ "}
            <Link
              to="/leagues/$leagueId/opponents/$teamId"
              params={{ leagueId, teamId: entry.counterpartyTeam.id }}
              className="underline-offset-2 hover:underline"
            >
              {entry.counterpartyTeam.abbreviation}
            </Link>
          </>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {entry.detail ?? "—"}
      </TableCell>
    </TableRow>
  );
}

function CareerLogSection(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  const regular = detail.seasonStats.filter((row) => !row.playoffs);
  const playoff = detail.seasonStats.filter((row) => row.playoffs);

  if (regular.length === 0 && playoff.length === 0) {
    return (
      <Section title="Statistics">
        <p
          className="text-sm text-muted-foreground"
          data-testid="player-career-log-empty"
        >
          No box score data recorded yet.
        </p>
      </Section>
    );
  }

  const positionColumns = statColumnsForBucket(detail.neutralBucket);
  const statKeys = positionColumns.map((c) => c.key);
  const currentSeasonYear = Math.max(
    ...detail.seasonStats.map((r) => r.seasonYear),
  );

  return (
    <Section title="Statistics">
      <CareerLogTable
        caption="Regular season"
        rows={regular}
        positionColumns={positionColumns}
        statKeys={statKeys}
        leagueId={leagueId}
        playerId={detail.id}
        currentSeasonYear={currentSeasonYear}
        testId="player-career-log-regular"
      />
      {playoff.length > 0 && (
        <CareerLogTable
          caption="Playoffs"
          rows={playoff}
          positionColumns={positionColumns}
          statKeys={statKeys}
          leagueId={leagueId}
          playerId={detail.id}
          currentSeasonYear={currentSeasonYear}
          testId="player-career-log-playoffs"
        />
      )}
    </Section>
  );
}

function CareerLogTable(
  {
    caption,
    rows,
    positionColumns,
    statKeys,
    leagueId,
    playerId,
    currentSeasonYear,
    testId,
  }: {
    caption: string;
    rows: PlayerSeasonStatRow[];
    positionColumns: { key: string; label: string }[];
    statKeys: string[];
    leagueId: string;
    playerId: string;
    currentSeasonYear: number;
    testId: string;
  },
) {
  const totals = computeCareerTotals(rows, statKeys);

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {caption}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>GP</TableHead>
              <TableHead>GS</TableHead>
              {positionColumns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-testid={`player-career-row-${row.id}`}
              >
                <TableCell>
                  {row.seasonYear === currentSeasonYear
                    ? (
                      <Link
                        to="/leagues/$leagueId/players/$playerId"
                        params={{ leagueId, playerId }}
                        hash="splits"
                        className="underline-offset-2 hover:underline"
                        data-testid={`player-splits-link-${row.id}`}
                      >
                        {row.seasonYear}
                      </Link>
                    )
                    : row.seasonYear}
                </TableCell>
                <TableCell>
                  <Link
                    to="/leagues/$leagueId/opponents/$teamId"
                    params={{ leagueId, teamId: row.team.id }}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.team.abbreviation}
                  </Link>
                </TableCell>
                <TableCell>{row.gamesPlayed}</TableCell>
                <TableCell>{row.gamesStarted}</TableCell>
                {positionColumns.map((col) => (
                  <TableCell key={col.key}>
                    {col.key in row.stats
                      ? formatStatValue(row.stats[col.key])
                      : "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow
              className="font-semibold"
              data-testid={`${testId}-totals`}
            >
              <TableCell colSpan={2}>Career Totals</TableCell>
              <TableCell>{totals.gamesPlayed}</TableCell>
              <TableCell>{totals.gamesStarted}</TableCell>
              {positionColumns.map((col) => (
                <TableCell key={col.key}>
                  {formatStatValue(totals.stats[col.key])}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AccoladesSection({ detail }: { detail: PlayerDetailData }) {
  const entries = detail.accolades;
  if (entries.length === 0) {
    return (
      <Section title="Accolades">
        <p
          className="text-sm text-muted-foreground"
          data-testid="player-accolades-empty"
        >
          No accolades yet.
        </p>
      </Section>
    );
  }
  return (
    <Section title="Accolades">
      <Card data-testid="player-accolades">
        <CardContent className="flex flex-col gap-2 pt-4">
          {entries.map((entry) => <AccoladeRow key={entry.id} entry={entry} />)}
        </CardContent>
      </Card>
    </Section>
  );
}

function AccoladeRow({ entry }: { entry: PlayerAccoladeEntry }) {
  return (
    <div
      className="flex items-center gap-3 text-sm"
      data-testid={`player-accolade-${entry.id}`}
    >
      <Badge variant="secondary">{entry.seasonYear}</Badge>
      <span className="font-medium">{accoladeLabels[entry.type]}</span>
      {entry.detail && (
        <span className="text-muted-foreground">· {entry.detail}</span>
      )}
    </div>
  );
}
