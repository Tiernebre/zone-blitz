# Retrospective: Custom Components vs. Shadcn

**Date:** 2026-04-13 **Scope:** Client UI components built between PRs #26–#44

---

## What Happened

Between the initial client scaffold (PR #26) and the shadcn integration (PR
#45), all UI was built with raw HTML elements and hand-written Tailwind classes.
This produced a set of custom components that were functional but:

- Used hardcoded color values (`gray-800`, `gray-300`, `red-600`, etc.) instead
  of theme-aware tokens
- Reimplemented patterns that shadcn already provides out of the box
- Were inconsistent in spacing, sizing, and interaction states
- Could not be themed or restyled without touching every component

### Components That Had to Be Migrated

| Component / Pattern   | Where                     | What Was Custom                                                                        | Shadcn Replacement                                 |
| --------------------- | ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Sidebar navigation    | `league/layout.tsx`       | Custom flex layout with manual collapse toggle, raw `<button>` and `<a>` elements      | Button, buttonVariants, Tooltip, Separator         |
| User profile dropdown | `user-menu.tsx`           | Custom `useState` open/close, absolute-positioned `<div>` dropdown, raw styled buttons | DropdownMenu (trigger, content, items)             |
| Delete confirmation   | `league/settings.tsx`     | Inline `useState` toggle between "Delete" and "Confirm/Cancel" buttons                 | _(still needs AlertDialog — see below)_            |
| League table          | `league-select/index.tsx` | Raw `<table>` with custom row styling                                                  | Table, TableHeader, TableBody, TableRow, TableCell |
| Form inputs           | `league-select/index.tsx` | Raw `<input>` with manual styling                                                      | Input                                              |
| Buttons everywhere    | Multiple files            | Raw `<button>` with per-instance Tailwind classes                                      | Button with variant/size props                     |
| Team selection cards  | `team-select/index.tsx`   | Custom `<button>` styled as a card                                                     | _(still custom — see below)_                       |

### Migration Effort

- **PR #45** (`5ed235e`): Installed 7 shadcn components (Button, Card,
  DropdownMenu, Input, Separator, Table, Tooltip) and rewrote user-menu and
  layout to use them.
- **PR #47** (`8dc3b87`): Migrated team-select to use Card, Separator, and theme
  tokens.
- Multiple follow-up fix commits for lint issues in generated shadcn files.

---

## What Still Needs Attention

### 1. Delete Confirmation — needs AlertDialog (High Priority)

`league/settings.tsx:17` still uses a `useState` toggle for the delete
confirmation flow. This should be an `AlertDialog` component with proper modal
focus trapping and accessible labeling.

### 2. TeamCard — needs Button component (Medium Priority)

`team-select/index.tsx:28-52` has a custom `<button>` styled as a selection
card. This should use the shadcn `Button` component (possibly a new variant) to
stay consistent.

### 3. Loading/Error States — needs Skeleton + Alert (Low Priority)

Several pages use inline `<p>` tags for loading and error states:

- `team-select/index.tsx:68-80`
- `league-select/index.tsx:72-76`

These could use shadcn `Skeleton` (for loading) and `Alert` (for errors) once
the app grows.

---

## Root Cause

The UI was built incrementally before a component library decision was made.
Each new feature added its own styled elements, leading to divergent patterns.
By the time shadcn was introduced, ~10 files needed rework.

---

## Going Forward: Shadcn-First Policy

1. **Check shadcn before building.** Before creating any UI element, search the
   shadcn registry for an existing component. If one exists, install and use it.

2. **Never use raw HTML interactive elements.** No `<button>`, `<input>`,
   `<select>`, `<table>`, `<dialog>` — always use the shadcn wrapper.

3. **Use theme tokens exclusively.** `bg-background`, `text-foreground`,
   `border-border`, `text-muted-foreground`, etc. Never hardcode color values
   like `gray-800` or `red-600`.

4. **Install components proactively.** When a feature needs a confirmation
   dialog, sidebar, dropdown, or form — install the shadcn component first, then
   build the feature on top of it.

5. **Audit on each new feature.** Before opening a PR that touches the client,
   verify no raw HTML elements are used where shadcn equivalents exist.

---

## Action Items

- [ ] Add `alert-dialog` component and migrate `league/settings.tsx`
- [ ] Refactor `TeamCard` to use Button component
- [ ] Consider adding `skeleton` and `alert` components for loading/error states
- [ ] Add a lint rule or PR checklist item to catch raw `<button>`, `<input>`,
      `<table>` usage in feature code (outside of `components/ui/`)
