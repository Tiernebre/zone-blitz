import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useCreateLeague } from "../../hooks/use-leagues.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CREATION_STAGES, STAGE_INTERVAL_MS } from "./stages.ts";

export function CreateLeague() {
  const createLeague = useCreateLeague();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [stageIndex, setStageIndex] = useState(0);

  const isPending = createLeague.isPending;

  useEffect(() => {
    if (!isPending) {
      setStageIndex(0);
      return;
    }
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, CREATION_STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createLeague.mutate(
      { name: trimmed },
      {
        onSuccess: (result) => {
          navigate({
            to: "/leagues/$leagueId/team-select",
            params: { leagueId: String(result.league.id) },
          });
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 pt-16 pb-24 text-foreground">
      <div className="w-full max-w-xl">
        {!isPending && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="mb-8 -ml-2 text-muted-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back to leagues
          </Button>
        )}

        {!isPending
          ? (
            <>
              <header className="space-y-3 text-center">
                <h1 className="text-4xl font-bold tracking-tight">
                  Create a new league
                </h1>
                <p className="text-muted-foreground">
                  Name your franchise. We'll generate the rest — teams, coaches,
                  players, and a full season schedule.
                </p>
              </header>

              <form onSubmit={handleSubmit} className="mt-10 space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="league-name"
                    className="text-sm font-medium"
                  >
                    League name
                  </label>
                  <Input
                    id="league-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Gridiron Classic"
                    autoFocus
                  />
                </div>

                {createLeague.isError && (
                  <Alert variant="destructive">
                    <AlertTitle>Failed to create league</AlertTitle>
                    <AlertDescription>
                      {createLeague.error?.message ??
                        "Something went wrong. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={!name.trim()}
                >
                  Create league
                </Button>
              </form>
            </>
          )
          : (
            <div
              className="mt-16 flex flex-col items-center gap-8"
              role="status"
              aria-live="polite"
            >
              <Loader2Icon className="size-12 animate-spin text-primary" />
              <div className="space-y-2 text-center">
                <p className="text-2xl font-semibold">
                  Building {name.trim() || "your league"}
                </p>
                <p
                  className="text-muted-foreground"
                  data-testid="current-stage"
                >
                  {CREATION_STAGES[stageIndex]}
                </p>
              </div>

              <ol className="w-full space-y-2">
                {CREATION_STAGES.map((stage, i) => {
                  const done = i < stageIndex;
                  const active = i === stageIndex;
                  return (
                    <li
                      key={stage}
                      className={`flex items-center gap-3 rounded-md border px-4 py-2 text-sm transition ${
                        active
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : done
                          ? "border-border/50 text-muted-foreground"
                          : "border-border/50 text-muted-foreground/60"
                      }`}
                      data-state={done ? "done" : active ? "active" : "pending"}
                    >
                      {done
                        ? (
                          <CheckIcon
                            className="size-4 text-primary"
                            aria-hidden
                          />
                        )
                        : active
                        ? (
                          <Loader2Icon
                            className="size-4 animate-spin text-primary"
                            aria-hidden
                          />
                        )
                        : (
                          <span
                            aria-hidden
                            className="size-4 rounded-full border border-border"
                          />
                        )}
                      <span>{stage}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
      </div>
    </div>
  );
}
