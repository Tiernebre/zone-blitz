# UI Architecture

## Stack Overview

| Layer            | Technology                        | Purpose                            |
| ---------------- | --------------------------------- | ---------------------------------- |
| Build tool       | Vite                              | Fast dev server, bundling          |
| Framework        | React + TypeScript                | UI rendering, type safety          |
| Styling          | Tailwind CSS                      | Utility-first CSS                  |
| Component system | shadcn/ui (Radix UI primitives)   | Accessible, customizable UI kit    |
| Data tables      | TanStack Table                    | Headless table logic               |
| Charts           | Recharts                          | Composable chart components        |
| Forms            | React Hook Form + Zod             | Performant forms, runtime schemas  |
| Shared schemas   | Zod (shared package)              | Validation shared with backend     |
| Theming          | Tailwind + CSS variables          | Dark mode from day one             |

## Why This Stack

### No server-side rendering

This is a web game, not a content site. There is no SEO requirement. Vite + React
gives us a fast SPA with simple deployment — no SSR complexity, no hydration
bugs, no server infrastructure for the frontend.

### Tailwind CSS + shadcn/ui

**shadcn/ui** is not a traditional component library — it generates source code
into the project. We own every component and can modify it freely. There is no
version-locked dependency to fight against.

Why this matters for the project:

- **Dashboard density.** A football sim GM view is a B2B dashboard: roster
  tables, salary cap breakdowns, scouting matrices, draft boards. shadcn/ui's
  data table, card, sheet, and dialog components handle this kind of dense,
  data-heavy UI well.
- **Dark mode.** shadcn/ui's theming system uses CSS variables with Tailwind,
  giving us dark mode support from day one with minimal effort.
- **AI-assisted development.** This stack has massive adoption and is heavily
  represented in training data. Claude can generate, modify, and debug
  Tailwind + shadcn/ui code with high accuracy. This is a deliberate
  productivity choice — the faster we can build UI, the more time we spend on
  game simulation logic.
- **Accessible by default.** Built on Radix UI primitives, which handle keyboard
  navigation, focus management, and ARIA attributes out of the box.

### TanStack Table + Recharts

Data tables and charts are the two most important UI elements in the application.
Rosters, draft boards, cap sheets, scouting reports, player comparisons — nearly
every screen is a table, a chart, or both.

- **TanStack Table** is headless — it provides sorting, filtering, pagination,
  column resizing, and row selection as logic, not as a styled component. We
  render it with our own Tailwind + shadcn/ui markup, keeping visual control.
- **Recharts** is composable and declarative. Player stat trends, team
  performance over time, and draft value charts are straightforward to build.

### React Hook Form + Zod

Forms appear throughout the app: trade proposals, lineup settings, league
configuration, draft pick submissions. React Hook Form avoids unnecessary
re-renders on large forms, and Zod schemas are shared between the client and
server in a shared package — a single source of truth for validation.

## Application Structure

```
src/
  features/        # Top-level application sections (one per nav item)
  components/      # Shared components used across features
  hooks/           # Shared hooks
  lib/             # Utilities, API client, types
```

### Features

A **feature** maps 1:1 to a top-level navigation item. It represents a bounded
section of the application with its own layout, scoped components, and flows.

```
features/
  media/
    components/    # Components scoped to this feature only
    flows/         # User journeys within the feature
      mock-draft/
      power-rankings/
    layout.tsx     # Feature shell (sub-nav, sidebar, etc.)
    index.tsx      # Feature entry point / default route
  free-agency/
    components/
    flows/
      marketplace/
      negotiations/
    layout.tsx
    index.tsx
  draft/
    components/
    flows/
      draft-room/
      draft-board/
    layout.tsx
    index.tsx
```

Features are bounded by the navigation structure. The number of features grows
slowly — you are not going to have 30 nav items. This natural constraint
prevents the folder sprawl that happens when organizing by domain entity.

A simple feature that has no sub-journeys (e.g. settings) can skip the `flows/`
directory and just be a single page.

### Flows

A **flow** is a user journey within a feature. It is a route — a page that wires
together components for a specific task.

Flows are **thin**. A flow file handles:

- Route definition and layout
- Data fetching and state wiring
- Composing shared and feature-scoped components

If a flow file is growing large, the fix is extracting components — not adding
more code to the flow.

### Components

Components live in one of two places:

| Location                      | Scope                                           |
| ----------------------------- | ----------------------------------------------- |
| `src/components/`             | Shared across features                          |
| `src/features/<name>/components/` | Scoped to a single feature                  |

**The rule:** if a component is used by more than one feature, it moves to
`src/components/`. If it is only used within a single feature, it stays scoped
to that feature's `components/` directory.

Shared components can be lightly grouped by purpose:

```
components/
  ui/              # shadcn/ui generated components (Button, Dialog, etc.)
  tables/          # Table column definitions, table wrappers
  charts/          # Chart configurations, chart wrappers
  player/          # PlayerCard, PlayerAvatar, PlayerStatLine
```

### Routing

Routes mirror the feature/flow structure:

```
/media                    -> features/media/index.tsx
/media/mock-draft         -> features/media/flows/mock-draft/
/media/power-rankings     -> features/media/flows/power-rankings/
/draft                    -> features/draft/index.tsx
/draft/draft-room         -> features/draft/flows/draft-room/
/free-agency              -> features/free-agency/index.tsx
/free-agency/marketplace  -> features/free-agency/flows/marketplace/
```

## Component Philosophy

### Semantic domain components over raw utilities

Tailwind utility classes are the styling engine, but they should not dominate
application code. The goal is semantic, domain-meaningful components:

```tsx
// Preferred: domain component that encapsulates styling
<RosterTable players={roster} onRelease={handleRelease} />
<CapBreakdownChart team={team} />
<ScoutingGradeBar grade={player.speed} />

// Avoid: raw Tailwind in page-level code
<div className="flex flex-col gap-4 p-6 bg-card rounded-lg border ...">
  <table className="w-full text-sm ...">
    ...dozens of utility classes scattered through JSX
  </table>
</div>
```

shadcn/ui primitives (`Button`, `Card`, `Dialog`, `Sheet`) handle generic UI
patterns. Domain components (`RosterTable`, `CapBreakdownChart`) handle
game-specific patterns. Flows compose both.

### Dark mode

Dark mode is supported from day one using shadcn/ui's CSS variable theming
approach. All color usage goes through semantic tokens (`bg-background`,
`text-foreground`, `border-border`) rather than hard-coded Tailwind colors. This
ensures every screen works in both themes without per-component overrides.
