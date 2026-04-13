import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCreateLeague, useLeagues } from "../../hooks/use-leagues.ts";
import { UserMenu } from "../../components/user-menu.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function LeagueSelect() {
  const { data: leagues, isLoading, error } = useLeagues();
  const createLeague = useCreateLeague();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="absolute top-4 right-4">
        <UserMenu />
      </div>
      <div className="w-full max-w-lg space-y-6 px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Zone Blitz</h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Football franchise simulation. Scout, draft, trade, and build your
          dynasty.
        </p>

        <div className="space-y-4 text-left">
          <h2 className="text-xl font-semibold">Leagues</h2>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              createLeague.mutate({ name: newName.trim() });
              setNewName("");
            }}
          >
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="League name..."
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={createLeague.isPending || !newName.trim()}
            >
              {createLeague.isPending ? "Creating..." : "Create"}
            </Button>
          </form>

          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading leagues...</p>
          )}
          {error && (
            <p className="text-sm text-destructive">Failed to load leagues</p>
          )}
          {leagues && leagues.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No leagues yet. Create one to get started.
            </p>
          )}
          {leagues && leagues.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagues.map((league) => (
                  <TableRow
                    key={league.id}
                    onClick={() =>
                      navigate({
                        to: "/leagues/$leagueId",
                        params: { leagueId: String(league.id) },
                      })}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      {league.name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
