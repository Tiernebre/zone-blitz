# League Genesis

Most franchise sims hand you a league that has already existed for fifty years.
Hall of Famers are already enshrined, dynasties have already risen and fallen,
and your "franchise" is just the latest GM slotting into a long chain of
predecessors. It's a fine starting point, but it means the most dramatic moment
in any league's life — its founding — is something you read about in a
retrospective rather than something you live through.

Zone Blitz takes the opposite approach. When you create a league, you are
creating a **brand-new professional football league**, in the spirit of the XFL,
UFL, or AAF. There is no prior history. No Hall of Fame. No all-time wins
leader. The first draft pick in league history hasn't been made yet — and you're
the one making it.

Every record is unset. Every rivalry is unwritten. The league's first champion
will be crowned ten months from the moment you click "Create League," and the
banner that team raises will hang in their rafters for as long as the league
exists.

The league also starts **small**. A new professional league doesn't launch with
thirty-two franchises, a seventeen-game schedule, and a full continental
footprint. It launches with a handful of founding franchises, a compressed
schedule, and an uncertain future — and if it survives its early seasons, it
grows. Zone Blitz models this growth as a core part of the long-term experience.
Year 1 is not the league at its final scale. Year 1 is the league at its
beginning.

## Design Philosophy

### The origin story is the hook

A franchise that started at Year 1 is a franchise whose entire history you
wrote. Twenty seasons in, when you look at your record book and see that _you_
drafted the league's first MVP, _you_ won the inaugural championship, _you_
traded the pick that became the league's first Hall of Famer — that's not flavor
text. That's your save file.

Faking decades of pre-generated history is a shortcut to a feeling of weight,
but it's a borrowed feeling. Genesis gives you the real one, earned over seasons
actually played.

### Genesis is a distinct phase, not a menu

League creation isn't "pick 32 teams and click Start." It's a multi-step
founding sequence that mirrors how a real start-up league comes into existence:
franchises are established, territories are claimed, a player pool is assembled,
an allocation draft distributes talent, and only then does the first regular
season kick off. Each step is a decision point with consequences that shape the
first several seasons.

### You are the owner _and_ the GM

In Zone Blitz, there is no separate "owner" sitting above you. You are a
**founding owner** who is also running football operations. That fusion is
canonical — it is how every franchise in a Zone Blitz league is run, yours and
every NPC's alike, for the life of the league.

This reflects the scrappy reality of a start-up league: there are no billionaire
absentee owners, no large front-office staffs, no established chains of command
above the people actually running the teams. The people who put the league
together are the people running the teams. You pick the city, you pick the
colors, you sign the checks, you make the draft picks, you fire the coach if it
isn't working. NPC franchises work the same way — a single AI persona owns the
franchise and runs football operations.

The fused role shapes what decisions are available to you:

- **Franchise-level calls** (identity, relocation, expansion votes, non-cap
  spending) are yours, period
- **Football operations** (roster, cap, draft, trades, coaching hires) are also
  yours
- **There is no owner patience meter pointed at you** — you can't fire yourself,
  and no one above you is threatening to. Stakes still exist, but they come from
  fans, media, league peers, and the expansion vote rather than from an employer

This is a deliberate departure from the "GM works for an opaque owner" model
common to other franchise sims. In Zone Blitz, there is no such layer — and that
is the design, not a gap to fill later.

### Genesis is about declaration, not management

Later-league GMs manage what they already have: a roster, a cap situation, a fan
base with expectations. During genesis, you _found_: name the stadium, pick the
colors, choose a build philosophy, select the franchise cornerstone. The tone of
decision-making is different, and the UI should reflect that — genesis screens
are about declaration, not management.

### Genesis is the only way a league begins

There is no alternate creation flow. Zone Blitz does not offer a "jump into a
mature league with fictional history" mode. Every league — single-player or
multiplayer — begins at genesis and earns its history one season at a time. See
[0021 — Deprecate established mode](../decisions/0021-deprecate-established-mode.md)
for the decision that retired the old dual-path framing.

---

## The Founder's Journey

Before diving into the phases as a system, it's worth walking the experience as
a player lives it. The following narrative is the canonical genesis flow for a
single-player founder. Multiplayer flows differ only in who is making which
decisions — the structure is the same.

### Creating the league

You click "Create League." The first screens ask who the league _is_: pick a
name, set a tagline if you want one, decide how many founding franchises sit at
the table (8 is the default and recommended number). The league's scale implies
its shape — an 8-team league gets a shorter schedule, two divisions, a tight
playoff bracket. You can customize any of it, but the defaults are the intended
experience.

### Choosing your franchise

You're presented with the founding markets. Each is a pool entry — city, default
identity, market tier, a thumbnail brand package. You pick one and make it
yours: override the team name if you want, pick your colors, name your stadium.
The decisions you make here stick to this franchise for the life of the league.

The other seven franchises get auto-assigned to NPC owners, each with generated
personalities and market fits. You can see the full league shape before anything
else happens — who your rivals are going to be, what markets they represent,
which owners you'll be voting alongside for the next twenty seasons.

### Hiring your staff

With the franchise in place, you start building the people around it. You're
presented with a **candidate pool of coaches and scouts** — a generated slate of
head coach candidates, coordinator candidates, position coaches, and scouting
hires. Each has a tendency profile, a scheme preference, a career background,
and a personality.

**These candidates are unique to this league.** The head coach you hire does not
exist in any other save file. When you generate a new league, the entire
coaching and scouting universe is regenerated from scratch — no recurring names,
no shared pool across franchises. The person you pick to run your offense is a
one-of-one, and five leagues from now you will remember them by name because
there will never be another one.

You hire based on **fit with your philosophy**. If you're building through the
draft, maybe you prioritize a scout-forward front office over a big-name head
coach. If you want an immediate identity on the field, you chase the coordinator
whose scheme matches the veterans you're planning to draft. The staff you build
now shapes how the next several seasons unfold.

The NPC franchises hire in parallel from the same candidate pool — so the best
candidates are contested. If you wait to grab that elite defensive coordinator,
someone else will take them.

### The allocation draft

With the staff locked, the league opens the veteran pool and runs the allocation
draft. The pool isn't abstract — it's presented as people, with backstories that
situate them in a world where no pro football league has yet dominated:

- **Raw college athletes** who slipped through the cracks of the existing
  football pipelines and never got a shot
- **Practice-squad journeymen** from established leagues who want real snaps
- **Veterans on the back end of careers** looking to prove they still belong
- **Middling pros** who never broke through and are betting on themselves to
  become stars in a league where the ceiling is open

You draft from this pool across a configurable number of rounds. Every pick has
a story. The NPC owners draft alongside you, each one informed by the coaching
staff they just hired and the philosophy they declared.

### Free agency and roster finalization

Everyone unsigned from the founding pool becomes a free agent — including the
young players who, in a mature league, would have been rookies. In Year 1 there
is no separate rookie draft; the allocation draft was the one distribution
event, and free agency mops up everyone who didn't get picked. You round out
your roster, manage your cap, and sign the depth you need. This is the first
time cap management matters, and it's the moment the owners who got greedy in
the allocation draft discover they can't afford kicker.

### Kickoff

You advance the state machine. Preseason begins. Real football follows. The
league's first Week 1 is days away, and the first touchdown in the history of
this league is about to be scored by somebody on somebody.

### The first real offseason

After Year 1 ends — first champion crowned, first MVP named, first standings
written into the record book — the league enters its first true offseason. This
is when the **first rookie draft** finally happens: scouted over the course of
Year 1, ordered by Year 1 standings, and run against the backdrop of a league
that now has real context. The Year 2 rookie draft is the moment the league
starts behaving like a mature institution, and the first name called in it is
the first player ever drafted under normal league rules.

### The seasons that follow

For the first several seasons, every franchise is roughly on equal footing. Cap
space is level, rosters are comparable, no one has a dynastic head start. What
separates teams is the quality of the staff they hired and the picks they made —
and those differences compound.

Then, at some point, an NPC owner (or you) proposes expansion. The league votes.
Maybe it passes, maybe it doesn't. If it does, new franchises are founded, an
expansion draft takes pieces of the existing rosters, and the league grows. If
it doesn't, the proposal shelves and the eight original franchises keep shaping
the league's identity alone for another few seasons.

Twenty seasons in, you look at your record book and see every name on it is
someone you drafted, signed, traded for, hired, or watched another owner build
around. None of it was pre-generated. All of it happened at your table.

---

## Genesis Phases

The founding of a league proceeds through an ordered sequence of phases. Each
phase unlocks the next. Phases are distinct from the regular-season state
machine (see
[0014 — Season calendar and phase state machine](../decisions/0014-season-calendar-phase-state-machine.md))
— they run exactly once, before the league's first preseason.

### Phase 1: League charter

The commissioner (or single-player founder) defines the league itself:

- **League name** and optional motto/tagline
- **Founding franchise count**: defaults to **8**, configurable down to as few
  as 4 or up to a larger custom number. The canonical genesis experience is a
  small league — big enough for divisional play, small enough that every
  franchise matters and expansion has somewhere to grow into
- **Initial schedule length**: scales with league size. An 8-team league plays a
  shorter regular season (e.g. 10–12 games) than a mature 32-team league.
  Schedule length grows as the league expands (see
  [Expansion Over Time](#expansion-over-time))
- **Conference and division structure**: for small founding leagues, a single
  conference with two divisions of four is the default. Richer structures unlock
  as the league expands
- **Rules package**: cap, roster limits, draft rounds — the full set of knobs
  from [League Management](./league-management.md)

This phase is mostly mechanical. The storytelling begins in Phase 2.

### Phase 2: Franchise establishment

Each franchise slot is filled, in order:

- **Market selection**: which city/region does the franchise represent? Drawn
  from the default pool, expansion pool, or community team packs (see
  [Teams & Branding](./teams-and-branding.md))
- **Identity declaration**: team name, colors, mascot, stadium name. Defaults
  come from the selected pool entry but the founder may override any of them
- **Conference/division assignment**: placed into the structure from Phase 1,
  with geographic suggestions surfaced but not enforced
- **Ownership**: each franchise's founding owner _is_ the GM — a fused role, not
  an owner above a separate GM. For human-claimed franchises, that's you. For
  NPC franchises, a single AI persona is generated that handles both
  ownership-level decisions (identity, expansion votes, non-cap spending) and
  football operations (roster, draft, trades, coaching)

In multiplayer, this phase is where human owner/GMs claim their franchise. In
single-player, the founder picks their team and the remaining slots are
auto-filled with NPC-controlled franchises.

### Phase 3: Staff hiring

Before a roster can be built, each franchise hires the people who will evaluate
and develop that roster. The league generates a **candidate pool** of coaches
and scouts — head coaches, coordinators, position coaches, and scouting
department hires — and all franchises hire from that shared pool.

- **Each candidate is unique per league**: when a league is generated, its
  entire coaching and scouting universe is generated alongside it. No recurring
  names across save files, no shared pool between leagues. The head coach you
  hire today exists in this league and only this league. See
  [Coaches](./coaches.md) and [Scouting](./scouting.md) for how candidates are
  generated
- **Philosophy drives fit**: you pick candidates that match the build philosophy
  you declared during establishment. A rebuilding franchise may prioritize
  scouts; a win-now franchise may chase a veteran head coach
- **NPC franchises hire in parallel** using the same candidate pool, each
  owner/GM AI making choices informed by its personality and philosophy

**Hiring is competitive.** The candidate pool is shared across the entire
league, and there are no restraints on who can pursue whom. When an elite
defensive coordinator hits the market, every franchise that wants one is chasing
the same person. Candidates have preferences — they may favor franchises with a
particular market tier, a specific philosophy, or a specific head coach already
in place — and they make choices about where to sign based on those preferences
plus the compensation on offer.

This creates a real bidding game during genesis. You can try to lock in your
coordinator early with an aggressive offer, gamble on later rounds to preserve
budget, or chase a named talent you know an NPC owner is also after. NPC owners
pursue hires with the same urgency you do — a good hire for them is one you
don't get. Multiplayer adds a human layer on top: two franchises can find
themselves bidding against each other for the same head coach in real time. The
hire you fail to make because someone outbid you will work against you for the
next decade.

**Coaches and scouts are gems and busts, too.** The same uncertainty that shapes
the allocation draft applies to the staff. The veteran head coach with an
acclaimed career at a prior level may prove rigid and fail to adapt to this
league's talent. The unproven position coach who just barely made the candidate
pool may turn out to be a future hall-of-fame head coach — but only if you hire
him before someone else does, and only if you give him the room to grow into the
role. Your front office is a draft pick, and it can hit or miss the same way
your first-round allocation selection can.

Staff hires made here directly affect the allocation draft that follows and the
first rookie draft in Year 2 — scouting reports, positional grades, and
scheme-fit evaluations all flow from the staff in place.

### Phase 4: Founding player pool

Before any draft can happen, a pool of available players has to exist. In a
genesis league, there is no prior season to draw veterans from, so the pool is
constructed from people who weren't part of existing pro football pipelines, or
who were but want a different shot. The lore categories:

- **Raw college athletes** who weren't given a chance in established pro
  football — undrafted prospects, small-school talents, late bloomers
- **Practice-squad journeymen** from other leagues who want real snaps and the
  chance to start somewhere new
- **Veterans on the back end of their careers** still chasing proof that they
  belong, willing to sign with an upstart league for the opportunity
- **Middling pros** who never broke through in an established league and are
  betting they can become stars when the ceiling is wide open

These categories are narrative — they shape how a player is presented in
scouting reports, profiles, and media coverage — but they don't create separate
mechanical systems. Every player in the pool shares the same attribute model.

**Attributes are normalized to the Zone Blitz scale.** A founding-era player's
ratings reflect their value within _this league_, not within some external
real-world football hierarchy. If the pool were measured against a top-tier
established league, most of these players would rate poorly — but they're not
being measured against that. They're being measured against each other and
against every player who will ever appear in this league. The league's top
quarterback in Year 1 is a top quarterback, full stop. Whether he would have
started in the NFL is not a question the game needs to answer.

This normalization is critical to the feel of the early league: the league takes
itself seriously, the stars are stars, and the attribute spread is calibrated so
that scheme fit, development, and front-office quality actually differentiate
teams.

**There is no inaugural rookie draft.** Young players — the age cohort that
would become rookies in a mature league — exist inside the founding pool
alongside every other archetype, undifferentiated from the rest of the talent.
Every player in Year 1 arrives through a single door: the allocation draft and
the free agency that follows it.

The first true rookie draft happens in **Year 2**, once the league has played a
season, established standings, and generated a real rookie class on the regular
offseason cadence. Deferring the rookie draft keeps genesis focused on the one
distribution event that matters — the allocation draft — and gives the first
rookie class the weight it deserves: it's the first time the league picks
between high-school-to-pro-pipeline young talent and everyone else, and it
happens against a real competitive backdrop instead of a randomized founding
order.

Pool size and talent distribution are league settings — a deep pool produces an
immediately competitive league, a thin pool produces scrappier early seasons
where the Year 2 rookie draft carries more weight.

### Phase 5: Allocation draft

The veteran pool is distributed to franchises via an allocation draft. This is
the closest Zone Blitz comes to simulating the XFL/UFL's "territorial picks" and
opening drafts.

- Draft order is randomized (no prior records exist to seed it from)
- Franchises draft from the veteran pool over a configurable number of rounds
- Each pick comes with a starter contract generated under the cap rules
- Positional needs and scheme fit matter, but teams are mostly assembling a
  roster from scratch — every pick is meaningful

The allocation draft is the **only draft in Year 1**. It distributes every
player in the founding pool — veterans, journeymen, and rookie-age talent alike.
The first true rookie draft, drawing on a fresh rookie class with Year 1
standings setting the order, happens the following offseason (see
[Drafting](./drafting.md)).

**Every player is technically a rookie here.** It's the league's first year.
Nobody has played a down of Zone Blitz football yet. A 34-year-old
back-end-of-career journeyman and an 22-year-old raw college athlete are both,
in this league's record book, first-year players. That framing matters: it means
every founding-pool player is eligible for the league's first-ever rookie-ish
awards, every one of them has a clean record with this league, and every one of
them is a fresh evaluation problem for the scouts you just hired.

**And like any real draft, this one has gems and busts.** Your scouts' reports
are the best information available, but they are not the truth. The raw college
athlete your coordinator fell in love with may wash out in two seasons. The
back-end-of-career vet everyone else passed on in round four may catch a second
wind in a new league with a new scheme and become a cornerstone. The
"can't-miss" headliner your front office spent the first overall pick on may not
miss — or he may be the league's first great bust, and you will be reminded of
that pick every time you look at your record book. The uncertainty is the point.
If the allocation draft were just a sorted list of the best players, it would be
a spreadsheet. It isn't, because no one — not you, not the NPC owners, not the
scouts — knows yet which of these people are built for this league.

### Phase 6: Free agency and roster finalization

After the allocation draft, any unsigned members of the founding pool become
available as free agents. Franchises round out their rosters up to the league's
roster limits, respecting the cap.

### Phase 7: Kickoff

The league transitions from genesis into its standard season state machine. The
founding is over. History starts being written.

---

## The Inaugural Calendar

The standard season calendar documented in
[League Management](./league-management.md) assumes a mature league with a
stable annual rhythm — offseason in spring, free agency and draft in April, OTAs
and minicamp in summer, preseason in August, kickoff in September. That calendar
doesn't work for Year 1, because Year 1 has a whole front-loaded sequence —
league charter, franchise establishment, staff hiring, allocation draft — that
doesn't exist in subsequent offseasons.

The inaugural calendar is its own thing. It anchors on a founder-chosen kickoff
date and runs the genesis phases in the months before, compressing some beats
and eliminating others entirely:

### Year 1 timeline (illustrative)

- **Founding window** (weeks before kickoff, founder-paced): charter, franchise
  establishment, staff hiring, founding pool generation, allocation draft, free
  agency. The whole genesis sequence is compressed into this window. In
  single-player it runs at the founder's pace. In multiplayer it runs on
  commissioner-set deadlines or ready-checks
- **Training camp** (brief, abstracted): the league's first ever training camp.
  Franchises finalize roster cuts down to the active limit. Because there is no
  preseason yet, training camp is the only evaluation window before Week 1
- **No preseason games in Year 1**: there is no prior infrastructure for
  preseason — no stadiums running test games, no media apparatus, no schedule of
  exhibition matchups. Year 1 skips preseason entirely and opens straight into
  the regular season
- **Regular season**: compressed to match the 8-team league scale (~10–12
  games), playing out on a normal weekly cadence
- **Playoffs and championship**: the first-ever playoffs and the first league
  championship
- **First real offseason** (post-Year-1): the league's normal offseason rhythm
  begins — awards, coaching carousel (if any franchises fire their genesis
  hires), free agency, and the **first true rookie draft** ahead of Year 2

### Year 2 and beyond

Starting in Year 2, the league settles into the standard calendar from
[League Management](./league-management.md) — including preseason, which the
league now has the institutional infrastructure to run. The founding-window
phases do not recur. Expansion cycles, when they happen, insert themselves into
the normal offseason rather than creating a special founding-like window.

This distinction matters for the UI and the state machine: Year 1's phases are a
one-time sequence, not a recurring offseason template. See
[0014 — Season calendar and phase state machine](../decisions/0014-season-calendar-phase-state-machine.md)
for how this should be modeled.

---

## Expansion Over Time

Genesis is the beginning, not the end. A league that founds at 8 teams is
explicitly designed to _grow_. Expansion is how the league evolves from a
scrappy start-up into a mature professional institution, and the path from 8 to
32 (or beyond) is meant to span many seasons and produce narrative beats of its
own.

### Why start small

A small founding league is not a compromise — it's a design choice with several
benefits:

- **Every franchise matters**: In an 8-team league, every team is a playoff
  contender on opening day and every matchup is a significant fraction of the
  season. There are no forgotten franchises.
- **Talent density is high**: A compressed veteran pool distributed across 8
  rosters produces deeper, more competitive teams than the same pool diluted
  across 32. Early-league football feels sharp.
- **Expansion has somewhere to go**: If the league starts at its final size,
  growth stops being part of the story. Starting small keeps expansion on the
  table for decades of play.
- **Onboarding is lighter**: A founder managing a genesis phase for 8 franchises
  is making a manageable number of identity, roster, and draft decisions.
  Thirty-two is a lot of setup before you play a single game.

### How expansion happens

Expansion is a **league-level event triggered by an ownership vote**. It is not
a commissioner diktat and it is not automatic. Because every founding franchise
is owner-operated, the decision to grow the league is made collectively by the
people who actually own the teams — you and every NPC owner alongside you.

An expansion proposal surfaces when league conditions make growth plausible: a
few stable seasons, healthy franchise finances, external market interest. When
one is tabled, every owner — human and NPC — casts a vote. NPC owners vote
according to their personalities and self-interest (a small-market owner may
fear talent dilution; an ambitious owner may welcome the larger stage; a
recently-successful owner may want to lock in structural advantages before new
teams can catch up). Your vote counts exactly as much as any other owner's: one
franchise, one vote.

If the vote passes, expansion proceeds. If it fails, the proposal is shelved and
may resurface after later seasons as the league evolves. Proposals can originate
from any owner — including you — so campaigning for or against expansion becomes
a meta-game of its own in multiplayer leagues.

Each expansion cycle adds a defined number of new franchises, typically 2 or 4
at a time to preserve scheduling symmetry.

The expansion cycle is structurally similar to genesis but scoped to the new
franchises:

1. **Expansion charter**: the commissioner decides how many teams to add, where
   they sit in conference/division structure, and whether the schedule length or
   playoff format should change to reflect the new size
2. **Franchise establishment**: each new franchise is founded the same way
   genesis franchises were — market, identity, ownership. In multiplayer, this
   is the moment new human GMs can join an existing league
3. **Expansion draft**: existing franchises expose a portion of their roster to
   an expansion pool, and the new franchises draft from it. This is a real cost
   to established teams and a real head start for the new ones. Protection
   lists, round counts, and pool size are all league settings
4. **Rookie draft adjustments**: expansion franchises typically receive
   favorable early picks in the next rookie draft, the degree of which is
   configurable
5. **Schedule and division realignment**: the league recomputes its schedule
   and, if needed, realigns divisions to accommodate the new footprint

Expansion happens between seasons — after the champion is crowned, before the
next free agency window opens.

### Natural scaling milestones

As the league grows, previously-locked structural features unlock:

- **12 teams**: three divisions of four; a meaningful unbalanced schedule
- **16 teams**: four-division conference structure; a full wild-card playoff
  round
- **24 teams**: dual-conference structure with full inter-conference play
- **32 teams**: the canonical "mature league" size — the structure most other
  franchise sims ship with at creation time
- **Beyond 32**: expansion can continue for leagues that want a larger
  footprint, though returns diminish and scheduling complexity grows

These aren't hard thresholds — the commissioner can configure any structure at
any size — but they represent natural inflection points where the league's shape
meaningfully changes.

### Expansion as narrative

Expansion is not a quiet administrative event. It's a league moment:

- Fans of the existing 8 franchises react to new teams carving into their talent
  pool and their geographic territory
- Existing GMs have to make hard decisions about which players to protect and
  which to expose to the expansion draft
- The new franchises arrive with the same "firsts" energy that the founding
  franchises had — first pick, first win, first playoff berth, first time
  beating an original franchise
- Media coverage (see [Media](./media.md)) treats expansion as a multi-week
  story arc, not a single event

A league that expands from 8 to 16 over twenty seasons has a richer history than
a league that was 16 the whole time. The growth itself is part of the record.

---

## Franchise Identity During Genesis

A franchise created during genesis isn't just a team — it's a declaration.

### Identity decisions are load-bearing

When a human GM establishes their franchise, the identity choices they make
aren't cosmetic:

- **Colors and name** theme the dashboard for the life of the franchise
- **Market selection** determines market tier, which shapes free agent appeal,
  media pressure, and owner patience from day one (see
  [Teams & Branding](./teams-and-branding.md))
- **Stadium name and city** become the anchor for every piece of lore the
  franchise will ever accrue — "The Miracle at Cascade Stadium" is only a phrase
  the media can coin if the stadium got named first

Unlike relocation — where the owner decides — genesis identity is the GM's to
declare. This is the one moment a GM has full creative control over who the
franchise _is_.

### Build philosophy

During genesis, each franchise declares a high-level build philosophy that
influences how its NPC systems behave in the early seasons:

- **Win now**: emphasize veterans in allocation draft, spend aggressively in
  free agency, trade future picks for present talent
- **Build through the draft**: emphasize rookies and picks, avoid long-term
  veteran contracts, accept early losing
- **Balanced**: no strong lean in either direction

For human GMs, the philosophy is a statement of intent — the game doesn't
enforce it. For NPC GMs, it meaningfully shapes their decision-making in the
allocation draft and first few free agency windows.

---

## Narrative Stakes

Genesis creates a dense cluster of "firsts" that the game should recognize and
surface through [Media](./media.md) and the league history system:

- First overall pick in the allocation draft
- First trade ever executed
- First touchdown, first interception, first sack
- First Week 1 victor
- First champion
- First MVP, first All-Pro team
- First overall pick in the first **real rookie draft** (Year 2) — a distinct
  milestone from the allocation draft, because it's the first time the league
  selects rookie-age talent through the offseason cadence it will use forever
  after
- First Rookie of the Year (Year 2, from that first rookie class)
- First franchise to reach ten wins, twenty wins, a hundred wins
- First Hall of Fame class (years later — founding-pool players and the Year 2
  rookie class, inducted at the end of their careers, become the charter Hall of
  Fame class)

These aren't just achievements. They are the league's foundational mythology,
and they only get to be set once. Every save file has its own pantheon.

---

## Single-Player vs Multiplayer Genesis

### Single-player

The founder picks their franchise, establishes its identity, and the remaining
founding franchises (seven, by default) are auto-generated with NPC owners, GMs,
and identities drawn from the default pool. The founder advances through each
genesis phase at their own pace. The allocation draft runs live with NPC
opponents making picks in real time; the first rookie draft follows in the Year
2 offseason. Future expansion cycles are decided by ownership votes across the
founder and the NPC owners, with the founder casting a single vote like everyone
else.

### Multiplayer

Each human GM claims a franchise during Phase 2. Genesis phases advance via the
same ready-check / commissioner-advancement system used during the regular
season (see [League Management](./league-management.md)). The allocation draft
is a live, real-time event run in the same draft room future rookie drafts will
use. The first rookie draft itself doesn't happen until the Year 2 offseason.

The commissioner has elevated control during genesis: they set the rules
package, lock franchise assignments, and run the allocation draft room. Once
kickoff occurs, the commissioner role settles into its standard shape.

---

## Interaction with Other Systems

### Teams & Branding

Genesis is where franchise identity is first declared. Everything in
[Teams & Branding](./teams-and-branding.md) applies from the moment a franchise
is established — colors theme the dashboard, market tier shapes appeal and
pressure, stadium name anchors lore. Relocation is a later-league event; it does
not occur during genesis.

### Drafting

The allocation draft uses the core draft mechanics defined in
[Drafting](./drafting.md), run against the founding player pool with randomized
initial order. Genesis does not introduce a new draft system. The first true
rookie draft happens in the Year 2 offseason, using the same mechanics, seeded
by Year 1 standings — no more randomization after the league has played real
football.

### Salary Cap

The cap is live from Phase 5 onward. Every contract signed in the allocation
draft and founding free agency period is cap-compliant. All franchises start
with the same cap space, which is the only moment in league history when the
playing field is perfectly level. See [Salary Cap](./salary-cap.md).

**Early-league economics are intentionally flat.** For the first several
seasons, the league's salary structure stays compressed — contracts are short,
guaranteed money is modest, and there isn't yet a class of mega-deals distorting
the market. This reflects the reality of a young league: there's no television
mega-deal funding the cap yet, players are taking shots on an unproven
institution, and no one has earned the kind of leverage that produces
record-setting contracts.

Over time, the economics evolve naturally:

- As **free agency cycles** accumulate, players who outperformed their
  founding-era deals gain real leverage and start commanding market-rate
  contracts
- As the **league matures and revenues grow** (via expansion, media interest,
  and fan growth), the cap itself grows
- As **stars emerge** and put together sustained careers, the league produces
  its first genuinely franchise-defining contracts — moments that matter because
  the player's career was built entirely inside this league's record

The salary curve is a deliberate arc: flat in year one, bending upward as the
league proves itself, producing its first generational contracts only after a
generation of football has been played.

### Coaches

Every coach available in the genesis candidate pool is generated uniquely for
this league. There is no recurring cast of named coaches shared across save
files. When you hire a head coach, you're hiring a one-of-one person with a
tendency profile, a scheme preference, and a career arc that will only ever play
out in this league. See [Coaches](./coaches.md) for how coach generation works —
genesis simply front-loads a full candidate pool before Phase 3 begins.

### Scouting

Scouts follow the same uniqueness rule as coaches — generated per league, never
shared across saves. Scouting reports on the founding player pool are available
during genesis, generated by the scouting staff each franchise hired in Phase 3.
The first _rookie-class_ scouting cycle begins during Year 1 and feeds into the
Year 2 rookie draft — scouts spend the league's inaugural season evaluating the
next generation of talent while the franchise is still finding its feet.
Scouting department investment is one of the genesis-phase decisions available
to each franchise. See [Scouting](./scouting.md).

### Ownership

In Zone Blitz, the owner and GM are the same person for every franchise —
human-claimed franchises are run by the player, NPC franchises are run by an AI
that wears both hats. There is no separate owner-above-GM layer anywhere in the
game. Ownership personality still matters as a concept — it drives expansion
votes, relocation decisions, and inter-franchise dynamics — but it is fused with
football operations, not layered above them. This is a core design choice, not a
genesis-era simplification.

### Media

Media coverage during genesis leans on the novelty of the league itself:
founding features, franchise previews, allocation-draft grades, rookie-draft
grades. Once the first game kicks off, media transitions into its standard
season coverage patterns. See [Media](./media.md).

---

## What Makes League Genesis Fun

- "I just drafted the first pick in league history. In twenty seasons, people
  will still be comparing every #1 overall to him."
- "The inaugural champion is going to be crowned at the end of this season. It
  could be anyone. No franchise has a banner. No franchise has a ring. The
  trophy has never been lifted. I want it to be me."
- "I established the Portland Riverhawks from scratch. I picked the name, I
  picked the colors, I picked the stadium. This isn't a franchise I inherited —
  this is a franchise I _founded_."
- "Our league is fifteen seasons deep now and I'm looking at the all-time record
  book. Every name on it is a player I either drafted, signed, traded for, or
  watched another GM build around. None of it was pre-generated. All of it
  happened at this table."
- "My friend group spun up a new league last week. Genesis phase took us two
  evenings. The allocation draft went four hours. We have not stopped talking
  about the picks."
- "We founded the league at 8 teams. Six seasons in we expanded to 12 and I lost
  my starting cornerback in the expansion draft. Two seasons after that he
  intercepted my quarterback in the playoffs. The league is telling its own
  story now."
- "I voted against expansion twice. The third proposal passed 5-3. I was on the
  losing end of that vote and now I have to decide which of my guys to expose. I
  love this game."
- "I own this team. I run this team. There's no billionaire telling me what my
  budget is, no board second-guessing my hires. When the league grows or
  doesn't, it's because I and seven other owners made that call around a table.
  This is football start-up stuff."
- "I hired Marcus Ellery as my head coach in year one. He exists only in my
  league. When I spin up a new save tomorrow, he's gone — a whole new slate of
  coaches will be generated. That's going to make this save's history feel
  permanent in a way nothing else has."
- "My quarterback was a practice-squad guy from another league. Nobody had ever
  given him a real shot. He's throwing for 4,000 yards in this league because in
  _this_ league, he's a star. The ratings reflect who he is here, not who he was
  measured as somewhere else."
- "Contracts in year one felt modest — short deals, not a lot of guaranteed
  money. By year six, my best pass rusher is commanding a deal that would have
  been unthinkable at founding. The economy grew up with the league."
- "I lost the bidding war for the coordinator I wanted. He went to a division
  rival and designed the defense that beat me in Week 3. I'm going to be
  thinking about that hiring phase for the next ten seasons."
- "There was no preseason in Year 1 — the league didn't have one yet. We went
  straight from training camp into a Week 1 that nobody had a read on. Half the
  league's depth charts looked nothing like what people expected."

## Related decisions

- [0017 — League genesis as the default creation flow](../decisions/0017-league-genesis-default-creation-flow.md)
  (superseded by 0021)
- [0018 — Genesis phase state machine](../decisions/0018-genesis-phase-state-machine.md)
- [0019 — Inaugural Year 1 calendar (no preseason)](../decisions/0019-inaugural-year-one-calendar.md)
- [0021 — Deprecate established mode; genesis is the only creation flow](../decisions/0021-deprecate-established-mode.md)
- [0022 — Fused owner/GM role as canonical](../decisions/0022-fused-owner-gm-role.md)
- [0023 — Contested staff hiring market](../decisions/0023-contested-staff-hiring-market.md)
- [0024 — Allocation draft as Year 1's only draft](../decisions/0024-allocation-draft-as-year-one-only-draft.md)
- [0025 — Expansion by ownership vote](../decisions/0025-expansion-by-ownership-vote.md)
- [0026 — Founding player pool composition and attribute normalization](../decisions/0026-founding-pool-composition-and-attribute-normalization.md)
