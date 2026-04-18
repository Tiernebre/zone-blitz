package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import java.util.Objects;
import java.util.Optional;

/**
 * Default {@link PlayNarrator} — produces concise, present-tense English descriptions. Output is
 * deliberately unadorned (no ESPN flourish) so that calibration and automated tests can match on
 * stable substrings.
 */
final class DefaultPlayNarrator implements PlayNarrator {

  @Override
  public String narrate(PlayEvent event, NarrationContext context) {
    Objects.requireNonNull(context, "context");
    return switch (event) {
      case null -> throw new NullPointerException("event");
      case PlayEvent.PassComplete pc -> passComplete(pc, context);
      case PlayEvent.PassIncomplete pi -> passIncomplete(pi, context);
      case PlayEvent.Sack s -> sack(s, context);
      case PlayEvent.Scramble s -> scramble(s, context);
      case PlayEvent.Interception i -> interception(i, context);
      case PlayEvent.Run r -> run(r, context);
      case PlayEvent.FieldGoalAttempt fg -> fieldGoal(fg, context);
      case PlayEvent.ExtraPoint xp -> extraPoint(xp, context);
      case PlayEvent.TwoPointAttempt tp -> twoPoint(tp);
      case PlayEvent.Punt p -> punt(p, context);
      case PlayEvent.Kickoff k -> kickoff(k, context);
      case PlayEvent.Penalty p -> penalty(p, context);
      case PlayEvent.Kneel k -> "%s. Kneel down.".formatted(situation(k));
      case PlayEvent.Spike s -> "%s. Spike.".formatted(situation(s));
      case PlayEvent.Timeout t -> "Timeout, %s.".formatted(context.nameOf(t.team()));
      case PlayEvent.TwoMinuteWarning w ->
          "Two-minute warning, Q%d.".formatted(w.clockAfter().quarter());
      case PlayEvent.EndOfQuarter e -> endOfQuarter(e);
    };
  }

  private String passComplete(PlayEvent.PassComplete pc, NarrationContext ctx) {
    var base =
        "%s %s throws to %s for %d."
            .formatted(
                situation(pc), ctx.nameOf(pc.qb()), ctx.nameOf(pc.target()), pc.totalYards());
    return base + scoreOrFirstDown(pc.touchdown(), pc.firstDown()) + spotSuffix(pc.endSpot());
  }

  private String passIncomplete(PlayEvent.PassIncomplete pi, NarrationContext ctx) {
    return "%s %s threw an incomplete pass intended for %s (%s)."
        .formatted(
            situation(pi), ctx.nameOf(pi.qb()), ctx.nameOf(pi.target()), describe(pi.reason()));
  }

  private String sack(PlayEvent.Sack s, NarrationContext ctx) {
    var first = s.sackers().isEmpty() ? "defense" : ctx.nameOf(s.sackers().get(0));
    var base =
        "%s %s sacked by %s for -%d."
            .formatted(situation(s), ctx.nameOf(s.qb()), first, Math.abs(s.yardsLost()));
    return base + fumbleSuffix(s.fumble(), ctx);
  }

  private String scramble(PlayEvent.Scramble s, NarrationContext ctx) {
    var base = "%s %s scrambles for %d.".formatted(situation(s), ctx.nameOf(s.qb()), s.yards());
    if (s.touchdown()) {
      return base + " TOUCHDOWN." + spotSuffix(s.endSpot());
    }
    if (s.slideOrOob()) {
      return base + " Slides/out of bounds." + spotSuffix(s.endSpot());
    }
    return base + spotSuffix(s.endSpot());
  }

  private String interception(PlayEvent.Interception i, NarrationContext ctx) {
    var base =
        "%s %s intercepted by %s, returned %d."
            .formatted(
                situation(i), ctx.nameOf(i.qb()), ctx.nameOf(i.interceptor()), i.returnYards());
    if (i.touchdown()) {
      return base + " PICK SIX." + spotSuffix(i.endSpot());
    }
    return base + spotSuffix(i.endSpot());
  }

  private String run(PlayEvent.Run r, NarrationContext ctx) {
    var base =
        "%s %s runs (%s) for %d."
            .formatted(
                situation(r),
                ctx.nameOf(r.carrier()),
                r.concept().name().toLowerCase().replace('_', ' '),
                r.yards());
    var suffix = scoreOrFirstDown(r.touchdown(), r.firstDown()) + fumbleSuffix(r.fumble(), ctx);
    return base + suffix + spotSuffix(r.endSpot());
  }

  private String fieldGoal(PlayEvent.FieldGoalAttempt fg, NarrationContext ctx) {
    return switch (fg.result()) {
      case GOOD ->
          "%s %s %d-yard field goal is GOOD."
              .formatted(situation(fg), ctx.nameOf(fg.kicker()), fg.distance());
      case MISSED ->
          "%s %s %d-yard field goal MISSED."
              .formatted(situation(fg), ctx.nameOf(fg.kicker()), fg.distance());
      case BLOCKED ->
          "%s %s %d-yard field goal BLOCKED%s."
              .formatted(
                  situation(fg),
                  ctx.nameOf(fg.kicker()),
                  fg.distance(),
                  fg.blocker().map(b -> " by " + ctx.nameOf(b)).orElse(""));
    };
  }

  private String extraPoint(PlayEvent.ExtraPoint xp, NarrationContext ctx) {
    return switch (xp.result()) {
      case GOOD -> "%s %s extra point is GOOD.".formatted(situation(xp), ctx.nameOf(xp.kicker()));
      case MISSED -> "%s %s extra point MISSED.".formatted(situation(xp), ctx.nameOf(xp.kicker()));
      case BLOCKED ->
          "%s %s extra point BLOCKED.".formatted(situation(xp), ctx.nameOf(xp.kicker()));
    };
  }

  private String twoPoint(PlayEvent.TwoPointAttempt tp) {
    var kind = tp.play().name().toLowerCase();
    return "%s Two-point %s %s.".formatted(situation(tp), kind, tp.success() ? "GOOD" : "NO GOOD");
  }

  private String punt(PlayEvent.Punt p, NarrationContext ctx) {
    var returner = p.returner().map(ctx::nameOf).orElse("no return");
    return "%s %s punts %d yds — %s (%s, %d return)."
        .formatted(
            situation(p),
            ctx.nameOf(p.punter()),
            p.grossYards(),
            p.result().name().toLowerCase().replace('_', ' '),
            returner,
            p.returnYards());
  }

  private String kickoff(PlayEvent.Kickoff k, NarrationContext ctx) {
    var prefix = k.onside() ? "Onside kick by" : "Kickoff by";
    var returner = k.returner().map(ctx::nameOf).orElse("no return");
    return "%s %s %s — %s (%s, %d return)."
        .formatted(
            situation(k),
            prefix,
            ctx.nameOf(k.kicker()),
            k.result().name().toLowerCase().replace('_', ' '),
            returner,
            k.returnYards());
  }

  private String penalty(PlayEvent.Penalty p, NarrationContext ctx) {
    var type = p.type().name().toLowerCase().replace('_', ' ');
    var against = ctx.nameOf(p.against());
    var replay = p.replayDown() ? ", replay down" : "";
    return "%s FLAG — %s on %s (%s), %d yards%s."
        .formatted(situation(p), type, against, ctx.nameOf(p.committedBy()), p.yards(), replay);
  }

  private String endOfQuarter(PlayEvent.EndOfQuarter e) {
    if (e.quarter() == 2) {
      return "End of first half.";
    }
    if (e.quarter() == 4) {
      return "End of regulation.";
    }
    return "End of Q%d.".formatted(e.quarter());
  }

  // --- helpers ----------------------------------------------------------------------------------

  private static String situation(PlayEvent event) {
    var dd = event.preSnap();
    var clock = event.clockBefore();
    var spot = describeSpot(event.preSnapSpot());
    if (dd.down() == 0) {
      return "(%s %s, %s)".formatted(clockLabel(clock), spot, "kickoff/free");
    }
    return "(%s %s-%s, %s)"
        .formatted(clockLabel(clock), ordinal(dd.down()), distance(dd.yardsToGo()), spot);
  }

  private static String clockLabel(GameClock clock) {
    var q = clock.quarter();
    var label = q >= 5 ? "OT" + (q - 4 == 1 ? "" : Integer.toString(q - 4)) : "Q" + q;
    var minutes = clock.secondsRemaining() / 60;
    var seconds = clock.secondsRemaining() % 60;
    return "%s %d:%02d".formatted(label, minutes, seconds);
  }

  private static String describeSpot(FieldPosition spot) {
    var y = spot.yardLine();
    if (y <= 50) {
      return "own " + y;
    }
    return "opp " + (100 - y);
  }

  private static String spotSuffix(FieldPosition spot) {
    return " Ball at %s.".formatted(describeSpot(spot));
  }

  private static String ordinal(int n) {
    return switch (n) {
      case 1 -> "1st";
      case 2 -> "2nd";
      case 3 -> "3rd";
      case 4 -> "4th";
      default -> n + "th";
    };
  }

  private static String distance(int yardsToGo) {
    return yardsToGo <= 0 ? "goal" : Integer.toString(yardsToGo);
  }

  private static String scoreOrFirstDown(boolean touchdown, boolean firstDown) {
    if (touchdown) {
      return " TOUCHDOWN.";
    }
    if (firstDown) {
      return " 1ST DOWN.";
    }
    return "";
  }

  private String fumbleSuffix(Optional<FumbleOutcome> fumble, NarrationContext ctx) {
    return fumble
        .map(
            f -> {
              var by = ctx.nameOf(f.fumbledBy());
              if (f.defenseRecovered()) {
                var rec = f.recoveredBy().map(ctx::nameOf).orElse("defense");
                return " FUMBLE by %s, recovered by %s (%d return)."
                    .formatted(by, rec, f.returnYards());
              }
              return " FUMBLE by %s, recovered by offense.".formatted(by);
            })
        .orElse("");
  }

  private static String describe(IncompleteReason reason) {
    return switch (reason) {
      case BROKEN_UP -> "broken up";
      case OVERTHROWN -> "overthrown";
      case UNDERTHROWN -> "underthrown";
      case DROPPED -> "dropped";
      case BATTED -> "batted";
      case THROWN_AWAY -> "thrown away";
    };
  }
}
