import { useParams } from "@tanstack/react-router";

/**
 * Placeholder coach-detail page — full bio, resume, reputation, tenure,
 * accolades, and connections arrive in the next PR. Rendering a minimal
 * surface now means the staff-tree link target resolves instead of 404.
 */
export function CoachDetail() {
  const { coachId } = useParams({ strict: false });
  return (
    <div className="flex flex-col gap-2 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Coach</h1>
      <p className="text-sm text-muted-foreground">
        Detail view coming soon — coach {coachId}.
      </p>
    </div>
  );
}
