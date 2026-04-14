---
name: file-adr-tickets
description: Turn an Accepted ADR into GitHub Issues that agents can claim. Use when a new ADR lands in docs/product/decisions/ or the user asks to "file tickets for ADR NNNN". Slices the ADR's Decision section into one issue per implementation deliverable, wires dependencies, and applies labels so agents can `gh issue list --label ready-for-agent` to pick work.
---

# File ADR Tickets

You are acting as the Product Manager for this repo. An ADR captures a decision;
this skill turns it into claimable work.

## When to invoke

- The user says "file tickets for ADR NNNN" or points at a decision doc.
- An ADR just transitioned to `Status: Accepted` in
  `docs/product/decisions/NNNN-*.md` and the implementation has not been filed
  yet.
- The user adds a `Implement ADR NNNN` line to `docs/backlog.md` — prefer filing
  tickets over leaving the bullet.

Do **not** invoke for ADRs still `Proposed` — the decision can still change.

## Inputs

- ADR path (required). If the user names an ADR number, resolve to the file
  under `docs/product/decisions/`.

## Procedure

### 1. Read the ADR fully

Before slicing anything, read:

- The target ADR end-to-end.
- Any ADR it links in the `Area:` or `Status:` frontmatter (supersedes / builds
  on).
- The relevant north-star doc (the ADR's `Area:` link).

Do not skim. The ADR's Decision section is the source of acceptance criteria —
wrong slicing upstream means wrong tickets downstream.

### 2. Slice into tickets

One ticket per **shippable deliverable**, not per paragraph. A good slice:

- Can be merged as a PR on its own without breaking `main`.
- Has a clear "done" condition that maps back to a specific line or sub-section
  of the ADR's Decision.
- Is small enough that a single agent session (or one focused PR) can complete
  it.

Heuristics:

- A new module / table / constant → its own ticket.
- Each consumer that has to adopt the new module → its own ticket, blocked by
  the module ticket.
- Test-only tightening, tuning, or telemetry → its own ticket if it's not
  required for the first consumer to ship.
- UI surface changes → separate from backend changes unless the change is
  trivially coupled.

Avoid:

- Giant "implement ADR NNNN" mega-tickets. That's what the ADR is.
- Tickets that just restate a sentence from Alternatives or Consequences — those
  aren't deliverables.

### 3. Draft each ticket

Use the issue template at `.github/ISSUE_TEMPLATE/adr-ticket.md` as the body
shape. Per ticket, fill in:

- **Title** — imperative, under 70 chars. Pattern: `<type>(<scope>): <what>`
  mirroring conventional-commit style when natural. Example:
  `feat(contracts): add positional market multiplier table`.
- **Context** — two or three sentences. What exists today; what this ticket
  changes. Link the ADR by path.
- **Acceptance criteria** — bulleted, checkable. Pull the specific invariants
  the ADR pins (e.g. "QB:RB salary ratio ≈ 2.75× at equal overall, asserted in
  tests"). If the ADR doesn't pin an invariant the ticket needs, flag it back to
  the user rather than inventing one.
- **Dependencies** — list of `#<issue>` refs that must land first. Use GitHub's
  `Depends on #N` syntax so the blocked-by graph renders.
- **ADR reference** — exact path, e.g.
  `docs/product/decisions/0011-positional-market-value.md`.

### 4. File in the right order

Create tickets root-first so dependency refs can point at real issue numbers:

1. File the ticket(s) with no dependencies.
2. Capture returned issue numbers.
3. File the next layer, substituting the real `#N` into `Depends on #N` lines
   and `--label blocked` where applicable.
4. Repeat until all tickets are filed.

Use `gh issue create` with a HEREDOC body:

```bash
gh issue create \
  --title "feat(contracts): add positional market multiplier table" \
  --label "adr:0011" --label "ready-for-agent" \
  --body "$(cat <<'EOF'
## Context
...
## Acceptance criteria
- [ ] ...
## Dependencies
(none)
## ADR reference
docs/product/decisions/0011-positional-market-value.md
EOF
)"
```

Tickets with unmet dependencies get `--label blocked` instead of
`ready-for-agent`. When their blocker closes, the skill (or whoever closes the
blocker) swaps the labels.

### 5. Update the backlog

- If a `Implement ADR NNNN` bullet exists in `docs/backlog.md`, replace it with
  a one-liner pointing at the tracking issues:
  `**2026-MM-DD — ADR NNNN tracked in issues #A, #B, #C.**`
- Leave unrelated backlog entries alone.

### 6. Report back

Print to the user:

- List of created issues (number + title).
- The dependency graph as an inline ASCII tree or indented bullets.
- Any ambiguity from the ADR that you had to decide or could not decide (surface
  these; don't bury them).

## Labels used by this skill

- `adr:NNNN` — every ticket derived from an ADR gets this. One label per ADR;
  create it on first use via
  `gh label create "adr:NNNN" --color BFD4F2
  --description "Derived from ADR NNNN" || true`.
- `ready-for-agent` — no unmet dependencies; an agent can claim it.
- `blocked` — has at least one open dependency. Swap to `ready-for-agent` when
  blockers close.

## Guardrails

- **Never file tickets for a Proposed ADR.** Decisions in flux produce churned
  tickets.
- **Never mechanize the slicing.** A script parsing headings is wrong more often
  than right — ADRs are prose. Read and judge.
- **Don't invent acceptance criteria the ADR didn't commit to.** If a ticket
  needs an invariant the ADR is silent on, ask the user to extend the ADR first,
  then file.
- **Don't file dozens of tickets silently.** If an ADR would produce more than
  ~6 tickets, stop and check with the user that the slicing is right before
  creating any.
