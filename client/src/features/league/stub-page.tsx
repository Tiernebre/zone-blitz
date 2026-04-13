import type { ReactNode } from "react";

interface StubPageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function StubPage({ title, description, children }: StubPageProps) {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Coming Soon
        </span>
      </div>
      <p className="max-w-2xl text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
