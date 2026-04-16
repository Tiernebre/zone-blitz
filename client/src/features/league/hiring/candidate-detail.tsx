import { Link, useParams } from "@tanstack/react-router";
import type { HiringCandidateDetail } from "@zone-blitz/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHiringCandidateDetail } from "../../../hooks/use-hiring.ts";
import { bandFor, formatMoney } from "./salary-bands.ts";

export function CandidateDetail() {
  const { leagueId, candidateId } = useParams({ strict: false }) as {
    leagueId: string;
    candidateId: string;
  };
  const { data, isLoading, error } = useHiringCandidateDetail(
    leagueId,
    candidateId,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6" data-testid="candidate-loading">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>
            This candidate is no longer in the hiring pool.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const band = bandFor(data.staffType, data.role);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="candidate-detail">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {data.firstName} {data.lastName}
          </h1>
          <Badge variant="secondary">{data.role}</Badge>
          <Badge variant="outline">{data.staffType}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Market band for this role: {formatMoney(band.min)} –{" "}
          {formatMoney(band.max)}
        </p>
        <Button asChild variant="link" className="self-start p-0">
          <Link
            to="/leagues/$leagueId/hiring"
            params={{ leagueId }}
            data-testid="back-to-hiring"
          >
            ← Back to hiring
          </Link>
        </Button>
      </header>

      <PreferencesCard detail={data} />
      <RevealCard detail={data} />
    </div>
  );
}

function PreferencesCard({ detail }: { detail: HiringCandidateDetail }) {
  return (
    <Card data-testid="preferences-card">
      <CardHeader>
        <CardTitle>What this candidate wants</CardTitle>
        <CardDescription>
          How strongly they weigh each factor when choosing where to sign. These
          are public — coaches and scouts don't hide their priorities during
          interviews.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <PrefRow label="Market tier" value={detail.marketTierPref} />
        <PrefRow label="Philosophy fit" value={detail.philosophyFitPref} />
        <PrefRow label="Staff fit" value={detail.staffFitPref} />
        <PrefRow label="Compensation" value={detail.compensationPref} />
      </CardContent>
    </Card>
  );
}

function PrefRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold">{value ?? "—"}</span>
    </div>
  );
}

function RevealCard({ detail }: { detail: HiringCandidateDetail }) {
  if (!detail.interviewReveal) {
    return (
      <Card data-testid="reveal-locked">
        <CardHeader>
          <CardTitle>Interview reveal locked</CardTitle>
          <CardDescription>
            Complete an interview with {detail.firstName}{" "}
            to learn about their coaching philosophy and how they'd fit your
            existing staff.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card data-testid="reveal-unlocked">
      <CardHeader>
        <CardTitle>What you learned in the interview</CardTitle>
        <CardDescription>
          Impressions from the interview. Not the whole picture — real
          performance only shows up on the field.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section>
          <h3 className="text-sm font-medium">Philosophy</h3>
          <pre
            className="mt-1 rounded-md bg-muted p-3 text-xs"
            data-testid="philosophy-reveal"
          >
            {JSON.stringify(detail.interviewReveal.philosophyReveal, null, 2)}
          </pre>
        </section>
        <section>
          <h3 className="text-sm font-medium">Staff fit</h3>
          <pre
            className="mt-1 rounded-md bg-muted p-3 text-xs"
            data-testid="staff-fit-reveal"
          >
            {JSON.stringify(detail.interviewReveal.staffFitReveal, null, 2)}
          </pre>
        </section>
      </CardContent>
    </Card>
  );
}
