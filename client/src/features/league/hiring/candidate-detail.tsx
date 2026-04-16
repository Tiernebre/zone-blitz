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
import { roleLabel } from "../role-labels.ts";
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
          <Badge variant="secondary">
            {roleLabel(data.staffType, data.role)}
          </Badge>
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

      <RevealCard detail={data} />
    </div>
  );
}

function hasReveal(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function RevealSection(
  { title, value, testId }: { title: string; value: unknown; testId: string },
) {
  if (!hasReveal(value)) {
    return (
      <section>
        <h3 className="text-sm font-medium">{title}</h3>
        <p
          className="mt-1 text-sm text-muted-foreground"
          data-testid={testId}
        >
          Not yet revealed — surfaces after a deeper interview.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h3 className="text-sm font-medium">{title}</h3>
      <pre
        className="mt-1 rounded-md bg-muted p-3 text-xs"
        data-testid={testId}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function RevealCard({ detail }: { detail: HiringCandidateDetail }) {
  const reveal = detail.interviewReveal;
  const philosophy = reveal?.philosophyReveal ?? null;
  const staffFit = reveal?.staffFitReveal ?? null;
  const anyRevealed = hasReveal(philosophy) || hasReveal(staffFit);

  if (!reveal || !anyRevealed) {
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
        <RevealSection
          title="Philosophy"
          value={philosophy}
          testId="philosophy-reveal"
        />
        <RevealSection
          title="Staff fit"
          value={staffFit}
          testId="staff-fit-reveal"
        />
      </CardContent>
    </Card>
  );
}
