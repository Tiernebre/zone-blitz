import { useState } from "react";
import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useAdvanceLeagueClock,
  useLeagueClock,
} from "../../hooks/use-league-clock.ts";

function formatSlug(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPhase(phase: string): string {
  return phase
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatClockHeading(
  phase: string,
  slug: string,
  seasonYear: number,
): string {
  return `${formatPhase(phase)} — ${formatSlug(slug)}, Year ${seasonYear}`;
}

interface LeagueClockDisplayProps {
  leagueId: string;
  isCommissioner: boolean;
}

export function LeagueClockDisplay({
  leagueId,
  isCommissioner,
}: LeagueClockDisplayProps) {
  const { data: clock } = useLeagueClock(leagueId);
  const advanceMutation = useAdvanceLeagueClock();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!clock) return null;

  const isSetupPhase = clock.phase.startsWith("initial_");
  const showInauguralYearNote = clock.isInauguralSeason && !isSetupPhase;

  const handleAdvance = () => {
    setConfirmOpen(false);
    advanceMutation.mutate(
      {
        leagueId,
        isCommissioner,
        gateState: {
          teams: [],
          draftOrderResolved: true,
          superBowlPlayed: true,
          priorPhaseComplete: true,
          allTeamsHaveStaff: false,
        },
      },
      {
        onSuccess: (data) => {
          const stepName = formatSlug(data.slug);
          const description = data.flavorDate
            ? `${formatPhase(data.phase)} — ${data.flavorDate}`
            : formatPhase(data.phase);
          toast.success(`Advanced to ${stepName}`, { description });
        },
        onError: (err) => {
          toast.error("Cannot Advance", { description: err.message });
        },
      },
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {formatClockHeading(clock.phase, clock.slug, clock.seasonYear)}
          </span>
          {clock.flavorDate && (
            <span className="text-xs text-muted-foreground">
              {clock.flavorDate}
            </span>
          )}
        </div>
        {isCommissioner && (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={advanceMutation.isPending}
                />
              }
            >
              <ChevronRightIcon />
              Advance
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Advance league?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will move the league forward to the next step. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAdvance}
                  disabled={advanceMutation.isPending}
                >
                  {advanceMutation.isPending
                    ? "Advancing..."
                    : "Confirm Advance"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {showInauguralYearNote && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <InfoIcon className="size-3" />
          <span>No preseason (inaugural year)</span>
        </div>
      )}
    </div>
  );
}
