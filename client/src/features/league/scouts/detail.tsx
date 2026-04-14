import { Link, useParams } from "@tanstack/react-router";
import type {
  ScoutConnection,
  ScoutDetail as ScoutDetailData,
  ScoutEvaluation,
  ScoutRole,
} from "@zone-blitz/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { useScoutDetail } from "../../../hooks/use-scout-detail.ts";

const ROLE_LABELS: Record<ScoutRole, string> = {
  DIRECTOR: "Scouting Director",
  NATIONAL_CROSS_CHECKER: "National Cross-checker",
  AREA_SCOUT: "Area Scout",
};

const CONNECTION_LABELS: Record<ScoutConnection["relation"], string> = {
  worked_under: "Worked under",
  peer: "Peer",
  mentee: "Mentee",
};

export function ScoutDetail() {
  const { scoutId, leagueId } = useParams({ strict: false }) as {
    scoutId: string;
    leagueId: string;
  };
  const { data, isLoading, error } = useScoutDetail(scoutId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6" data-testid="scout-skeleton">
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
          <AlertDescription>Failed to load scout detail.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const detail = data as ScoutDetailData;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header detail={detail} />
      <Resume detail={detail} />
      <Reputation detail={detail} />
      <TrackRecord detail={detail} />
      <ExternalRecord detail={detail} />
      <Connections detail={detail} leagueId={leagueId} />
    </div>
  );
}

function Header({ detail }: { detail: ScoutDetailData }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-tight">
        {detail.firstName} {detail.lastName}
      </h1>
      <p className="text-sm text-muted-foreground">
        {ROLE_LABELS[detail.role]}
        {detail.coverage && <span>· {detail.coverage}</span>}
      </p>
      <p className="text-sm text-muted-foreground">
        Age {detail.age} · {detail.yearsWithTeam} yr w/ team ·{" "}
        {detail.contractYearsRemaining} yr remaining · {detail.workCapacity}
        {" "}
        pts / cycle
      </p>
    </header>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

function Resume({ detail }: { detail: ScoutDetailData }) {
  return (
    <Section title="Resume">
      {detail.careerStops.length === 0
        ? (
          <p className="text-sm text-muted-foreground">
            No prior stops on record.
          </p>
        )
        : (
          <ul className="flex flex-col gap-2">
            {detail.careerStops.map((stop) => (
              <Card key={stop.id} className="flex flex-col gap-1 p-4">
                <p className="text-sm font-medium">
                  {stop.orgName} — {stop.role}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stop.startYear}–{stop.endYear ?? "present"}
                  {stop.coverageNotes && <span>· {stop.coverageNotes}</span>}
                </p>
              </Card>
            ))}
          </ul>
        )}
    </Section>
  );
}

function Reputation({ detail }: { detail: ScoutDetailData }) {
  return (
    <Section title="Reputation">
      {detail.reputationLabels.length === 0
        ? (
          <p className="text-sm text-muted-foreground">
            No league reputation yet.
          </p>
        )
        : (
          <div className="flex flex-wrap gap-2">
            {detail.reputationLabels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        )}
    </Section>
  );
}

function TrackRecord({ detail }: { detail: ScoutDetailData }) {
  return (
    <Section title="Track record with this team">
      <EvaluationsTable evaluations={detail.evaluations} />
      <CrossCheckList detail={detail} />
    </Section>
  );
}

function EvaluationsTable({
  evaluations,
}: {
  evaluations: ScoutEvaluation[];
}) {
  if (evaluations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No evaluations on file from his tenure.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Draft year</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Round tier</TableHead>
          <TableHead>Prospect</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Outcome</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {evaluations.map((e) => (
          <TableRow key={e.id}>
            <TableCell>{e.draftYear}</TableCell>
            <TableCell>{e.positionGroup}</TableCell>
            <TableCell>{e.roundTier}</TableCell>
            <TableCell>{e.prospectName}</TableCell>
            <TableCell>{e.grade}</TableCell>
            <TableCell>{e.evaluationLevel}</TableCell>
            <TableCell>
              {e.outcome}
              {e.outcomeDetail && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {e.outcomeDetail}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CrossCheckList({ detail }: { detail: ScoutDetailData }) {
  if (detail.crossChecks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Cross-check history</h3>
      <ul className="flex flex-col gap-1">
        {detail.crossChecks.map((c) => (
          <li key={c.id} className="text-sm text-muted-foreground">
            vs {c.otherScout
              ? `${c.otherScout.firstName} ${c.otherScout.lastName}`
              : "unknown scout"} · other grade:{" "}
            <span className="font-medium">{c.otherGrade}</span> · winner:{" "}
            <span className="font-medium">{c.winner}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExternalRecord({ detail }: { detail: ScoutDetailData }) {
  return (
    <Section title="Track record across the league">
      {detail.externalTrackRecord.length === 0
        ? (
          <p className="text-sm text-muted-foreground">
            No secondhand record on file.
          </p>
        )
        : (
          <Alert>
            <AlertTitle>Lower confidence — secondhand data</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 flex flex-col gap-1">
                {detail.externalTrackRecord.map((r) => (
                  <li key={r.id} className="text-sm">
                    {r.orgName} ({r.startYear}–{r.endYear ?? "present"}) —{" "}
                    {r.noisyHitRateLabel}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
    </Section>
  );
}

function Connections({
  detail,
  leagueId,
}: {
  detail: ScoutDetailData;
  leagueId: string;
}) {
  return (
    <Section title="Connections">
      {detail.connections.length === 0
        ? <p className="text-sm text-muted-foreground">No known connections.</p>
        : (
          <ul className="flex flex-col gap-2">
            {detail.connections.map((c) => (
              <li key={c.scout.id} className="text-sm">
                <span className="text-muted-foreground">
                  {CONNECTION_LABELS[c.relation]}:
                </span>{" "}
                <Link
                  to="/leagues/$leagueId/scouts/$scoutId"
                  params={{ leagueId, scoutId: c.scout.id }}
                  className="font-medium underline"
                >
                  {c.scout.firstName} {c.scout.lastName}
                </Link>
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}
