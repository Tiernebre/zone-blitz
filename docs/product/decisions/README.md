# Product Decisions

Short, dated records of specific product decisions. Each decision answers _why
we picked X over Y_ at a point in time. Decisions are immutable once merged — if
a later decision supersedes an earlier one, add a new entry and mark the old one
as superseded.

## How to add a decision

1. Copy [`TEMPLATE.md`](./TEMPLATE.md) to `NNNN-short-slug.md`, where `NNNN` is
   the next unused four-digit number.
2. Keep it short — aim for one page. If it's getting long, the decision probably
   belongs in a north-star doc instead.
3. If the decision changes the rules of a feature area, also update the relevant
   [`../north-star/`](../north-star/) doc and link back to this decision from
   the bottom of that doc.

## Log

- [0001 — Roster page: active roster + depth chart view](./0001-roster-page.md)
  — single page, two views, no depth-chart editing
- [0002 — Coaches page: org chart tree + coach detail view](./0002-coaches-page.md)
  — staff tree landing, one detail page per coach, no ratings surfaced
