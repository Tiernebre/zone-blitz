import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  HiringCandidateSummary,
  HiringDecisionView,
  HiringInterestView,
  HiringInterviewView,
  HiringOfferInput,
  HiringOfferView,
} from "@zone-blitz/shared";
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
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeague } from "../../../hooks/use-league.ts";
import { useLeagueClock } from "../../../hooks/use-league-clock.ts";
import {
  useExpressInterest,
  useHiringCandidates,
  useRequestInterviews,
  useSubmitOffers,
  useTeamHiringState,
} from "../../../hooks/use-hiring.ts";
import { useStaffTree } from "../../../hooks/use-staff-tree.ts";
import { useScoutStaffTree } from "../../../hooks/use-scout-staff-tree.ts";
import { roleLabel } from "../role-labels.ts";
import { bandFor, formatMoney, medianSalary } from "./salary-bands.ts";
import { stepDescription, stepHeadline, stepViewFor } from "./step-view.ts";

export function Hiring() {
  const { leagueId } = useParams({ strict: false }) as { leagueId: string };
  const { data: clock, isLoading: clockLoading } = useLeagueClock(leagueId);
  const { data: league } = useLeague(leagueId);
  const { data: teamState, isLoading: stateLoading } = useTeamHiringState(
    leagueId,
  );

  if (clockLoading || stateLoading) {
    return (
      <div className="flex flex-col gap-6 p-6" data-testid="hiring-loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const slug = clock?.slug ?? "";
  const view = stepViewFor(slug);

  if (view === "not_in_phase") {
    return (
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Hiring</h1>
          <p className="text-muted-foreground">
            The hiring market is closed. It will reopen during the coaching
            carousel.
          </p>
        </header>
      </div>
    );
  }

  const interestCap = (league as { interestCap?: number } | undefined)
    ?.interestCap;

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Hiring</h1>
          <Badge variant="secondary" data-testid="hiring-step-badge">
            {stepHeadline(slug)}
          </Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          {stepDescription(slug)}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {teamState && (
            <span data-testid="hiring-budget">
              Staff budget: {formatMoney(teamState.remainingBudget)} of{" "}
              {formatMoney(teamState.staffBudget)} remaining
            </span>
          )}
        </div>
      </header>

      {view === "market_survey" && (
        <MarketSurveyView
          leagueId={leagueId}
          interests={teamState?.interests ?? []}
          interestCap={interestCap}
        />
      )}
      {view === "interview" && (
        <InterviewView
          leagueId={leagueId}
          interests={teamState?.interests ?? []}
          interviews={teamState?.interviews ?? []}
          stepSlug={slug}
          interviewsPerWeek={(league as
            | { interviewsPerWeek?: number }
            | undefined)
            ?.interviewsPerWeek}
        />
      )}
      {view === "offers" && (
        <OffersView
          leagueId={leagueId}
          interviews={teamState?.interviews ?? []}
          offers={teamState?.offers ?? []}
          remainingBudget={teamState?.remainingBudget ?? 0}
          maxConcurrentOffers={(league as
            | { maxConcurrentOffers?: number }
            | undefined)?.maxConcurrentOffers}
        />
      )}
      {view === "decisions" && (
        <DecisionsView
          offers={teamState?.offers ?? []}
          decisions={teamState?.decisions ?? []}
        />
      )}
      {view === "finalize" && (
        <StaffResultView
          leagueId={leagueId}
          teamId={teamState?.teamId ?? ""}
        />
      )}
    </div>
  );
}

function useInterestedCandidateIds(
  interests: HiringInterestView[],
): Set<string> {
  return useMemo(
    () =>
      new Set(
        interests
          .filter((i) => i.status === "active")
          .map((i) => i.staffId),
      ),
    [interests],
  );
}

function MarketSurveyView(
  { leagueId, interests, interestCap }: {
    leagueId: string;
    interests: HiringInterestView[];
    interestCap: number | undefined;
  },
) {
  const { data, isLoading } = useHiringCandidates(leagueId);
  const interestedIds = useInterestedCandidateIds(interests);
  const expressInterest = useExpressInterest();

  if (isLoading) {
    return (
      <Skeleton data-testid="candidates-loading" className="h-64 w-full" />
    );
  }

  const atCap = interestCap !== undefined && interestedIds.size >= interestCap;

  const handleExpress = (candidateId: string) => {
    expressInterest.mutate(
      { leagueId, candidateIds: [candidateId] },
      {
        onSuccess: () => toast.success("Interest noted"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const renderAction = (c: HiringCandidateSummary) => {
    const interested = interestedIds.has(c.id);
    return (
      <Button
        size="sm"
        variant={interested ? "secondary" : "default"}
        disabled={interested || expressInterest.isPending || atCap}
        onClick={() => handleExpress(c.id)}
        data-testid={`express-interest-${c.id}`}
      >
        {interested ? "Interested" : "Express Interest"}
      </Button>
    );
  };

  const interestBadge = interestCap !== undefined
    ? (
      <Badge
        variant={interestedIds.size >= interestCap ? "destructive" : "default"}
        className="h-7 gap-2 px-3 text-sm font-semibold"
        data-testid="hiring-interest-counter"
      >
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">
          Interests Shown
        </span>
        <span className="tabular-nums">
          {interestedIds.size} / {interestCap}
        </span>
      </Badge>
    )
    : null;

  return (
    <Card data-testid="market-survey">
      <CardHeader>
        <CardTitle>Candidate Pool</CardTitle>
        <CardDescription>
          Search, filter, and mark the candidates you want to pursue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StaffTypeTabs
          leagueId={leagueId}
          candidates={data ?? []}
          renderAction={renderAction}
          testIdPrefix="market"
          toolbarEnd={interestBadge}
        />
      </CardContent>
    </Card>
  );
}

function InterviewView(
  {
    leagueId,
    interests,
    interviews,
    stepSlug,
    interviewsPerWeek,
  }: {
    leagueId: string;
    interests: HiringInterestView[];
    interviews: HiringInterviewView[];
    stepSlug: string;
    interviewsPerWeek: number | undefined;
  },
) {
  const { data: allCandidates, isLoading } = useHiringCandidates(leagueId);
  const requestInterviews = useRequestInterviews();

  const interviewByStaff = useMemo(() => {
    const map = new Map<string, HiringInterviewView>();
    for (const iv of interviews) map.set(iv.staffId, iv);
    return map;
  }, [interviews]);

  const requestedThisStep = useMemo(
    () => interviews.filter((iv) => iv.stepSlug === stepSlug).length,
    [interviews, stepSlug],
  );

  const activeInterests = useMemo(
    () => interests.filter((i) => i.status === "active"),
    [interests],
  );

  const interestedCandidates = useMemo(() => {
    if (!allCandidates) return [];
    const byId = new Map(allCandidates.map((c) => [c.id, c]));
    return activeInterests
      .map((i) => byId.get(i.staffId))
      .filter((c): c is HiringCandidateSummary => Boolean(c));
  }, [allCandidates, activeInterests]);

  if (isLoading) {
    return (
      <Skeleton
        data-testid="interview-view-loading"
        className="h-64 w-full"
      />
    );
  }

  if (interestedCandidates.length === 0) {
    return (
      <Alert data-testid="interview-empty">
        <AlertTitle>No candidates to interview</AlertTitle>
        <AlertDescription>
          You didn't express interest in any candidates during the market
          survey. Wait for the next wave or advance the clock.
        </AlertDescription>
      </Alert>
    );
  }

  const handleRequest = (candidateId: string) => {
    requestInterviews.mutate(
      { leagueId, candidateIds: [candidateId] },
      {
        onSuccess: () => toast.success("Interview requested"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const atCap = interviewsPerWeek !== undefined &&
    requestedThisStep >= interviewsPerWeek;

  const renderAction = (c: HiringCandidateSummary) => {
    const iv = interviewByStaff.get(c.id);
    if (iv?.status === "completed" || iv?.status === "accepted") {
      return <Badge variant="secondary">Interviewed</Badge>;
    }
    if (iv?.status === "requested") {
      return <Badge variant="outline">Pending</Badge>;
    }
    if (iv?.status === "declined") {
      return <Badge variant="destructive">Declined</Badge>;
    }
    return (
      <Button
        size="sm"
        disabled={requestInterviews.isPending || atCap}
        onClick={() => handleRequest(c.id)}
        data-testid={`request-interview-${c.id}`}
      >
        Request Interview
      </Button>
    );
  };

  const interviewBadge = interviewsPerWeek !== undefined
    ? (
      <Badge
        variant={atCap ? "destructive" : "default"}
        className="h-7 gap-2 px-3 text-sm font-semibold"
        data-testid="hiring-interview-counter"
      >
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">
          Interviews Requested
        </span>
        <span className="tabular-nums">
          {requestedThisStep} / {interviewsPerWeek}
        </span>
      </Badge>
    )
    : null;

  return (
    <Card data-testid="interview-view">
      <CardHeader>
        <CardTitle>Interviews</CardTitle>
        <CardDescription>
          Request interviews with candidates you're courting. Some will accept,
          some won't.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StaffTypeTabs
          leagueId={leagueId}
          candidates={interestedCandidates}
          renderAction={renderAction}
          testIdPrefix="interview"
          tabsEnd={interviewBadge}
          searchable={false}
        />
      </CardContent>
    </Card>
  );
}

function OffersView(
  {
    leagueId,
    interviews,
    offers,
    remainingBudget,
    maxConcurrentOffers,
  }: {
    leagueId: string;
    interviews: HiringInterviewView[];
    offers: HiringOfferView[];
    remainingBudget: number;
    maxConcurrentOffers: number | undefined;
  },
) {
  const { data: allCandidates, isLoading } = useHiringCandidates(leagueId);
  const submitOffers = useSubmitOffers();
  const offerByStaff = useMemo(() => {
    const map = new Map<string, HiringOfferView>();
    for (const o of offers) map.set(o.staffId, o);
    return map;
  }, [offers]);

  const eligible = useMemo(() => {
    if (!allCandidates) return [];
    const byId = new Map(allCandidates.map((c) => [c.id, c]));
    return interviews
      .filter((iv) => iv.status === "completed" || iv.status === "accepted")
      .map((iv) => byId.get(iv.staffId))
      .filter((c): c is HiringCandidateSummary => Boolean(c));
  }, [allCandidates, interviews]);

  if (isLoading) {
    return <Skeleton data-testid="offers-loading" className="h-64 w-full" />;
  }

  if (eligible.length === 0) {
    return (
      <Alert data-testid="offers-empty">
        <AlertTitle>No interviews completed</AlertTitle>
        <AlertDescription>
          Offers can only be extended to candidates who completed an interview.
        </AlertDescription>
      </Alert>
    );
  }

  const pendingCount = offers.filter((o) => o.status === "pending").length;
  const atOfferCap = maxConcurrentOffers !== undefined &&
    pendingCount >= maxConcurrentOffers;

  return (
    <Card data-testid="offers-view">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Extend Offers</CardTitle>
          <CardDescription>
            Offer a salary within the role's market band. Higher pay scores
            better against competing bids.
          </CardDescription>
        </div>
        {maxConcurrentOffers !== undefined && (
          <Badge
            variant={atOfferCap ? "destructive" : "default"}
            className="h-7 gap-2 px-3 text-sm font-semibold"
            data-testid="hiring-offer-counter"
          >
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">
              Offers Outstanding
            </span>
            <span className="tabular-nums">
              {pendingCount} / {maxConcurrentOffers}
            </span>
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {eligible.map((c) => (
          <OfferRow
            key={c.id}
            candidate={c}
            existing={offerByStaff.get(c.id) ?? null}
            remainingBudget={remainingBudget}
            onSubmit={(offer) =>
              submitOffers.mutate(
                { leagueId, offers: [offer] },
                {
                  onSuccess: () => toast.success("Offer submitted"),
                  onError: (err) => toast.error(err.message),
                },
              )}
            submitting={submitOffers.isPending}
            disabledAtCap={atOfferCap}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function OfferRow(
  {
    candidate,
    existing,
    remainingBudget,
    onSubmit,
    submitting,
    disabledAtCap,
  }: {
    candidate: HiringCandidateSummary;
    existing: HiringOfferView | null;
    remainingBudget: number;
    onSubmit: (offer: HiringOfferInput) => void;
    submitting: boolean;
    disabledAtCap: boolean;
  },
) {
  const band = bandFor(candidate.staffType, candidate.role);
  const [salary, setSalary] = useState(
    existing?.salary ?? medianSalary(candidate.staffType, candidate.role),
  );
  const [contractYears, setContractYears] = useState(
    existing?.contractYears ?? 3,
  );
  const displayRole = roleLabel(candidate.staffType, candidate.role);

  if (existing && existing.status !== "pending") {
    return (
      <div
        className="flex flex-col gap-1 rounded-md border p-3"
        data-testid={`offer-row-${candidate.id}`}
      >
        <div className="flex items-center justify-between">
          <div className="font-medium">
            {candidate.firstName} {candidate.lastName} ({displayRole})
          </div>
          <Badge
            variant={existing.status === "accepted" ? "secondary" : "outline"}
          >
            {existing.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatMoney(existing.salary)} × {existing.contractYears}y
        </p>
      </div>
    );
  }

  const underBand = salary < band.min;
  const overBand = salary > band.max;
  const overBudget = salary > remainingBudget;
  const submitDisabled = submitting || overBudget || Boolean(existing) ||
    disabledAtCap;

  const handleSubmit = () => {
    onSubmit({
      candidateId: candidate.id,
      salary,
      contractYears,
      buyoutMultiplier: "0.50",
    });
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-3"
      data-testid={`offer-row-${candidate.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">
          {candidate.firstName} {candidate.lastName} ({displayRole})
        </div>
        <span className="text-xs text-muted-foreground">
          Band: {formatMoney(band.min)} – {formatMoney(band.max)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          Salary
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-muted-foreground">
              $
            </span>
            <Input
              type="text"
              inputMode="numeric"
              value={salary.toLocaleString("en-US")}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setSalary(digits === "" ? 0 : Number(digits));
              }}
              className="w-40 pl-5 tabular-nums"
              data-testid={`offer-salary-${candidate.id}`}
            />
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Years
          <Input
            type="number"
            min={1}
            max={6}
            value={contractYears}
            onChange={(e) => setContractYears(Number(e.target.value))}
            className="w-20"
            data-testid={`offer-years-${candidate.id}`}
          />
        </label>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitDisabled}
          data-testid={`submit-offer-${candidate.id}`}
        >
          {existing ? "Submitted" : "Submit Offer"}
        </Button>
      </div>
      {(underBand || overBand || overBudget) && (
        <p
          className="text-xs text-destructive"
          data-testid={`offer-warning-${candidate.id}`}
        >
          {overBudget
            ? "Offer exceeds remaining staff budget."
            : underBand
            ? "Below role's typical band — high risk of being outbid."
            : "Above role's typical band — strong, but expensive."}
        </p>
      )}
    </div>
  );
}

function DecisionsView(
  { offers, decisions }: {
    offers: HiringOfferView[];
    decisions: HiringDecisionView[];
  },
) {
  const chosenOfferIds = new Set(
    decisions.map((d) => d.chosenOfferId).filter((id): id is string =>
      Boolean(id)
    ),
  );

  const won = offers.filter((o) => chosenOfferIds.has(o.id));
  const lost = offers.filter((o) => o.status === "rejected");
  const pending = offers.filter((o) => o.status === "pending");

  return (
    <Card data-testid="decisions-view">
      <CardHeader>
        <CardTitle>Decisions</CardTitle>
        <CardDescription>
          {pending.length} pending • {won.length} accepted • {lost.length}{" "}
          rejected
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {offers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You didn't have any active offers in this wave.
          </p>
        )}
        {offers.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Years</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow
                  key={o.id}
                  data-testid={`decision-row-${o.id}`}
                >
                  <TableCell>{o.staffId.slice(0, 8)}</TableCell>
                  <TableCell>{formatMoney(o.salary)}</TableCell>
                  <TableCell>{o.contractYears}</TableCell>
                  <TableCell>
                    <Badge
                      variant={o.status === "accepted"
                        ? "secondary"
                        : o.status === "rejected"
                        ? "destructive"
                        : "outline"}
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StaffResultView(
  { leagueId, teamId }: { leagueId: string; teamId: string },
) {
  const { data: coaches, isLoading: coachesLoading } = useStaffTree(
    leagueId,
    teamId,
  );
  const { data: scouts, isLoading: scoutsLoading } = useScoutStaffTree(
    leagueId,
    teamId,
  );

  if (coachesLoading || scoutsLoading) {
    return (
      <Skeleton data-testid="staff-result-loading" className="h-64 w-full" />
    );
  }

  const coachList = coaches ?? [];
  const scoutList = scouts ?? [];

  return (
    <div className="flex flex-col gap-4" data-testid="staff-result-view">
      <Alert>
        <AlertTitle>Staff Assembled</AlertTitle>
        <AlertDescription>
          Your Head Coach and Director of Scouting have built out the rest of
          the staff.
        </AlertDescription>
      </Alert>
      <Card data-testid="staff-result-coaches">
        <CardHeader>
          <CardTitle>Coaching Staff</CardTitle>
          <CardDescription>
            {coachList.length} coach{coachList.length === 1 ? "" : "es"}{" "}
            on staff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coachList.length === 0
            ? (
              <p className="text-sm text-muted-foreground">
                No coaches have been assigned yet.
              </p>
            )
            : <StaffTable rows={coachList} staffType="coach" />}
        </CardContent>
      </Card>
      <Card data-testid="staff-result-scouts">
        <CardHeader>
          <CardTitle>Scouting Staff</CardTitle>
          <CardDescription>
            {scoutList.length} scout{scoutList.length === 1 ? "" : "s"}{" "}
            on staff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scoutList.length === 0
            ? (
              <p className="text-sm text-muted-foreground">
                No scouts have been assigned yet.
              </p>
            )
            : <StaffTable rows={scoutList} staffType="scout" />}
        </CardContent>
      </Card>
    </div>
  );
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isVacancy: boolean;
}

function StaffTable(
  { rows, staffType }: { rows: StaffMember[]; staffType: "coach" | "scout" },
) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-testid={`staff-row-${row.id}`}>
            <TableCell>{roleLabel(staffType, row.role)}</TableCell>
            <TableCell>
              {row.isVacancy
                ? <Badge variant="outline">Vacant</Badge>
                : `${row.firstName} ${row.lastName}`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StaffTypeTabs(
  {
    leagueId,
    candidates,
    renderAction,
    testIdPrefix,
    toolbarEnd,
    tabsEnd,
    searchable = true,
  }: {
    leagueId: string;
    candidates: HiringCandidateSummary[];
    renderAction: (c: HiringCandidateSummary) => React.ReactNode;
    testIdPrefix: string;
    toolbarEnd?: React.ReactNode;
    tabsEnd?: React.ReactNode;
    searchable?: boolean;
  },
) {
  const coaches = candidates.filter((c) => c.staffType === "coach");
  const scouts = candidates.filter((c) => c.staffType === "scout");

  return (
    <Tabs defaultValue="coach" className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="coach" data-testid={`${testIdPrefix}-tab-coach`}>
            Coaches ({coaches.length})
          </TabsTrigger>
          <TabsTrigger value="scout" data-testid={`${testIdPrefix}-tab-scout`}>
            Scouts ({scouts.length})
          </TabsTrigger>
        </TabsList>
        {tabsEnd}
      </div>
      <TabsContent value="coach">
        <CandidateDataTable
          candidates={coaches}
          leagueId={leagueId}
          renderAction={renderAction}
          testId={`${testIdPrefix}-coach-table`}
          toolbarEnd={toolbarEnd}
          searchable={searchable}
        />
      </TabsContent>
      <TabsContent value="scout">
        <CandidateDataTable
          candidates={scouts}
          leagueId={leagueId}
          renderAction={renderAction}
          testId={`${testIdPrefix}-scout-table`}
          toolbarEnd={toolbarEnd}
          searchable={searchable}
        />
      </TabsContent>
    </Tabs>
  );
}

type CandidateRow = HiringCandidateSummary & {
  fullName: string;
  displayRole: string;
  bandMin: number;
  bandMax: number;
  medianSalary: number;
};

function toRows(candidates: HiringCandidateSummary[]): CandidateRow[] {
  return candidates.map((c) => {
    const band = bandFor(c.staffType, c.role);
    return {
      ...c,
      fullName: `${c.firstName} ${c.lastName}`,
      displayRole: roleLabel(c.staffType, c.role),
      bandMin: band.min,
      bandMax: band.max,
      medianSalary: medianSalary(c.staffType, c.role),
    };
  });
}

function buildCandidateColumns(
  leagueId: string,
  renderAction: (c: HiringCandidateSummary) => React.ReactNode,
): ColumnDef<CandidateRow>[] {
  return [
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <SortableHeader column={column}>Name</SortableHeader>
      ),
      cell: ({ row }) => (
        <Link
          to="/leagues/$leagueId/hiring/$candidateId"
          params={{ leagueId, candidateId: row.original.id }}
          className="font-medium underline-offset-2 hover:underline"
          data-testid={`candidate-link-${row.original.id}`}
        >
          {row.original.fullName}
        </Link>
      ),
    },
    {
      accessorKey: "displayRole",
      header: ({ column }) => (
        <SortableHeader column={column}>Role</SortableHeader>
      ),
      cell: ({ row }) => row.original.displayRole,
    },
    {
      accessorKey: "medianSalary",
      header: ({ column }) => (
        <SortableHeader column={column}>Expected Salary</SortableHeader>
      ),
      cell: ({ row }) => formatMoney(row.original.medianSalary),
    },
    {
      id: "band",
      header: "Market Band",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatMoney(row.original.bandMin)} –{" "}
          {formatMoney(row.original.bandMax)}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <span className="sr-only">Action</span>,
      cell: ({ row }) => (
        <div className="text-right">{renderAction(row.original)}</div>
      ),
    },
  ];
}

function CandidateDataTable(
  { candidates, renderAction, leagueId, testId, toolbarEnd, searchable = true }:
    {
      candidates: HiringCandidateSummary[];
      renderAction: (c: HiringCandidateSummary) => React.ReactNode;
      leagueId: string;
      testId?: string;
      toolbarEnd?: React.ReactNode;
      searchable?: boolean;
    },
) {
  const rows = useMemo(() => toRows(candidates), [candidates]);
  const columns = useMemo(
    () => buildCandidateColumns(leagueId, renderAction),
    [leagueId, renderAction],
  );

  const toolbar = (!searchable && !toolbarEnd)
    ? undefined
    : (table: import("@tanstack/react-table").Table<CandidateRow>) => (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {searchable
          ? (
            <Input
              aria-label="Search candidates"
              placeholder="Search by name or role…"
              value={(table.getState().globalFilter as string) ?? ""}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          )
          : <span />}
        {toolbarEnd}
      </div>
    );

  return (
    <div data-testid={testId}>
      <DataTable
        columns={columns}
        data={rows}
        getRowTestId={(row) => `candidate-row-${row.id}`}
        toolbar={toolbar}
      />
    </div>
  );
}
