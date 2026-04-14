import { Link, useParams } from "@tanstack/react-router";
import type { PlayerDetail as PlayerDetailData } from "@zone-blitz/shared";
import type { PlayerInjuryStatus } from "@zone-blitz/shared/types/player.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerDetail } from "../../../hooks/use-player-detail.ts";

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

function formatHeight(inches: number) {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${feet}'${remainder}"`;
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
      <Header detail={detail} leagueId={leagueId} />
      <Origin detail={detail} leagueId={leagueId} />
      <PreDraft detail={detail} />
      <PlaceholderSections />
    </div>
  );
}

function Header(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  return (
    <header className="flex flex-col gap-2" data-testid="player-header">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {detail.firstName} {detail.lastName}
        </h1>
        <Badge variant={injuryBadgeVariant(detail.injuryStatus)}>
          {formatInjury(detail.injuryStatus)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {detail.position} · Age {detail.age} ·{" "}
        {formatHeight(detail.heightInches)} · {detail.weightPounds} lbs ·{" "}
        {detail.yearsOfExperience} yr exp
      </p>
      <p className="text-sm text-muted-foreground">
        {detail.currentTeam
          ? (
            <>
              Currently with{" "}
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
          : <span>Unsigned free agent</span>}
      </p>
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

function Origin(
  { detail, leagueId }: { detail: PlayerDetailData; leagueId: string },
) {
  const { origin } = detail;
  const undrafted = origin.draftYear === null;
  return (
    <Section title="Origin">
      <Card data-testid="player-origin">
        <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <Fact label="Draft">
            {undrafted
              ? <span data-testid="player-origin-undrafted">Undrafted</span>
              : (
                <span data-testid="player-origin-draft">
                  {origin.draftYear}, Round {origin.draftRound} (Pick{" "}
                  {ordinal(origin.draftPick!)})
                </span>
              )}
          </Fact>
          <Fact label="Drafted by">
            {origin.draftingTeam
              ? (
                <Link
                  to="/leagues/$leagueId/opponents/$teamId"
                  params={{ leagueId, teamId: origin.draftingTeam.id }}
                  className="font-medium underline-offset-2 hover:underline"
                  data-testid="player-drafting-team-link"
                >
                  {origin.draftingTeam.city} {origin.draftingTeam.name}
                </Link>
              )
              : <span className="text-muted-foreground">—</span>}
          </Fact>
          <Fact label="College">
            <span>{origin.college ?? "—"}</span>
          </Fact>
          <Fact label="Hometown">
            <span>{origin.hometown ?? "—"}</span>
          </Fact>
        </CardContent>
      </Card>
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

function PlaceholderSections() {
  return (
    <Card data-testid="player-detail-placeholder">
      <CardHeader>
        <CardTitle>More coming soon</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Contract history, career log, transaction log, and accolades will
          appear here once the sim persists them.
        </p>
      </CardContent>
    </Card>
  );
}
