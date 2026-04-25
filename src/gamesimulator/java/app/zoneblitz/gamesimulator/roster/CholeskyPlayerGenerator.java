package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import app.zoneblitz.gamesimulator.role.TendencyAxis;
import java.lang.System.Logger;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Multivariate-correlated attribute sampler. For each position the constructor builds one {@link
 * PreparedComponent} per mixture component — with means/stddevs filled in for every axis (specified
 * in JSON or floor-defaulted) and a Cholesky factor of the component's correlation matrix. Sampling
 * is then {@code x = mean + diag(sd) · L · z} where {@code z ~ N(0, I)}, clipped to {@code [0,
 * 100]} and projected back into the three attribute records.
 *
 * <p>Cross-position floor: any axis not listed in a component's {@code means} draws from a sub-pro
 * baseline (mean 10, sd 5). A QB's punt power, a kicker's coverage technique — all generated near
 * 10, never accidentally elite.
 *
 * <p>Throws at construction if any component's correlation matrix is not positive semi-definite —
 * data validation, fail loudly rather than silently project.
 */
public final class CholeskyPlayerGenerator implements PlayerGenerator {

  static final double FLOOR_MEAN = 10.0;
  static final double FLOOR_STDDEV = 5.0;

  private static final int N = 31;
  private static final double SHRINKAGE_STEP = 0.02;
  private static final double MAX_SHRINKAGE = 0.5;
  private static final Logger log = System.getLogger(CholeskyPlayerGenerator.class.getName());

  private final Map<Position, PreparedProfile> prepared;

  public CholeskyPlayerGenerator(AttributeProfileRepository profiles) {
    Objects.requireNonNull(profiles, "profiles");
    var map = new EnumMap<Position, PreparedProfile>(Position.class);
    for (var position : Position.values()) {
      map.put(position, prepare(profiles.loadFor(position)));
    }
    this.prepared = Map.copyOf(map);
  }

  @Override
  public Player generate(PlayerId id, Position position, String displayName, RandomSource rng) {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(position, "position");
    Objects.requireNonNull(displayName, "displayName");
    Objects.requireNonNull(rng, "rng");

    var profile = prepared.get(position);
    var component = pickComponent(profile, rng.nextDouble());
    var z = new double[N];
    for (var i = 0; i < N; i++) {
      z[i] = rng.nextGaussian();
    }
    var sampled = applyCholesky(component, z);
    return assemblePlayer(id, position, displayName, sampled);
  }

  private static PreparedComponent pickComponent(PreparedProfile profile, double u) {
    var ladder = profile.cumulativeWeights();
    for (var i = 0; i < ladder.length; i++) {
      if (u <= ladder[i]) {
        return profile.components().get(i);
      }
    }
    return profile.components().get(profile.components().size() - 1);
  }

  private static int[] applyCholesky(PreparedComponent component, double[] z) {
    var means = component.means();
    var sds = component.stddevs();
    var L = component.cholesky();
    var result = new int[N];
    for (var i = 0; i < N; i++) {
      var y = 0.0;
      for (var j = 0; j <= i; j++) {
        y += L[i][j] * z[j];
      }
      var raw = means[i] + sds[i] * y;
      result[i] = clipToZeroHundred(raw);
    }
    return result;
  }

  private static int clipToZeroHundred(double v) {
    if (Double.isNaN(v)) {
      return 50;
    }
    var rounded = (int) Math.round(v);
    if (rounded < 0) return 0;
    if (rounded > 100) return 100;
    return rounded;
  }

  private static Player assemblePlayer(
      PlayerId id, Position position, String displayName, int[] sampled) {
    var phys =
        new Physical(
            sampled[idx(PhysicalAxis.SPEED)],
            sampled[idx(PhysicalAxis.ACCELERATION)],
            sampled[idx(PhysicalAxis.AGILITY)],
            sampled[idx(PhysicalAxis.STRENGTH)],
            sampled[idx(PhysicalAxis.POWER)],
            sampled[idx(PhysicalAxis.BEND)],
            sampled[idx(PhysicalAxis.STAMINA)],
            sampled[idx(PhysicalAxis.EXPLOSIVENESS)]);
    var skill =
        new Skill(
            sampled[idx(SkillAxis.PASS_SET)],
            sampled[idx(SkillAxis.ROUTE_RUNNING)],
            sampled[idx(SkillAxis.COVERAGE_TECHNIQUE)],
            sampled[idx(SkillAxis.PASS_RUSH_MOVES)],
            sampled[idx(SkillAxis.BLOCK_SHEDDING)],
            sampled[idx(SkillAxis.HANDS)],
            sampled[idx(SkillAxis.RUN_BLOCK)],
            sampled[idx(SkillAxis.BALL_CARRIER_VISION)],
            sampled[idx(SkillAxis.BREAK_TACKLE)],
            sampled[idx(SkillAxis.TACKLING)],
            sampled[idx(SkillAxis.KICK_POWER)],
            sampled[idx(SkillAxis.KICK_ACCURACY)],
            sampled[idx(SkillAxis.PUNT_POWER)],
            sampled[idx(SkillAxis.PUNT_ACCURACY)],
            sampled[idx(SkillAxis.PUNT_HANG_TIME)]);
    var tend =
        new Tendencies(
            sampled[idx(TendencyAxis.COMPOSURE)],
            sampled[idx(TendencyAxis.DISCIPLINE)],
            sampled[idx(TendencyAxis.FOOTBALL_IQ)],
            sampled[idx(TendencyAxis.PROCESSING)],
            sampled[idx(TendencyAxis.TOUGHNESS)],
            sampled[idx(TendencyAxis.CLUTCH)],
            sampled[idx(TendencyAxis.CONSISTENCY)],
            sampled[idx(TendencyAxis.MOTOR)]);
    return new Player(id, position, displayName, phys, skill, tend);
  }

  private static int idx(app.zoneblitz.gamesimulator.role.AttributeAxis axis) {
    return AxisRegistry.indexOf(axis);
  }

  private static PreparedProfile prepare(AttributeProfile profile) {
    var prepared = new java.util.ArrayList<PreparedComponent>(profile.components().size());
    var cumulative = new double[profile.components().size()];
    var running = 0.0;
    for (var i = 0; i < profile.components().size(); i++) {
      var c = profile.components().get(i);
      prepared.add(prepareComponent(c, profile.position()));
      running += c.weight();
      cumulative[i] = running;
    }
    return new PreparedProfile(List.copyOf(prepared), cumulative);
  }

  private static PreparedComponent prepareComponent(
      AttributeMixtureComponent component, Position position) {
    var means = new double[N];
    var sds = new double[N];
    for (var i = 0; i < N; i++) {
      var axis = AxisRegistry.AXES_IN_ORDER.get(i);
      means[i] = component.means().getOrDefault(axis, FLOOR_MEAN);
      sds[i] = component.stddevs().getOrDefault(axis, FLOOR_STDDEV);
    }
    var correlation = buildCorrelationMatrix(component);
    var L = cholesky(correlation, position, component.name());
    return new PreparedComponent(means, sds, L);
  }

  private static double[][] buildCorrelationMatrix(AttributeMixtureComponent component) {
    var R = new double[N][N];
    for (var i = 0; i < N; i++) {
      R[i][i] = 1.0;
    }
    for (var entry : component.correlations().entrySet()) {
      var i = AxisRegistry.indexOf(entry.getKey().a());
      var j = AxisRegistry.indexOf(entry.getKey().b());
      var rho = entry.getValue();
      R[i][j] = rho;
      R[j][i] = rho;
    }
    return R;
  }

  private static double[][] cholesky(double[][] A, Position position, String componentName) {
    var alpha = 0.0;
    while (alpha <= MAX_SHRINKAGE + 1.0e-9) {
      var L = tryCholesky(shrunken(A, alpha));
      if (L != null) {
        if (alpha > 0.0) {
          log.log(
              Logger.Level.WARNING,
              "Correlation matrix for position="
                  + position
                  + " component='"
                  + componentName
                  + "' required shrinkage α="
                  + String.format("%.2f", alpha)
                  + " to be PSD; off-diagonals scaled by "
                  + String.format("%.2f", 1.0 - alpha));
        }
        return L;
      }
      alpha += SHRINKAGE_STEP;
    }
    throw new IllegalArgumentException(
        "Correlation matrix not positive semi-definite for position="
            + position
            + " component='"
            + componentName
            + "' even with α="
            + MAX_SHRINKAGE
            + " shrinkage; review correlation entries");
  }

  private static double[][] shrunken(double[][] A, double alpha) {
    if (alpha == 0.0) {
      return A;
    }
    var scale = 1.0 - alpha;
    var out = new double[N][N];
    for (var i = 0; i < N; i++) {
      out[i][i] = 1.0;
      for (var j = 0; j < i; j++) {
        var v = A[i][j] * scale;
        out[i][j] = v;
        out[j][i] = v;
      }
    }
    return out;
  }

  private static double[][] tryCholesky(double[][] A) {
    var L = new double[N][N];
    for (var i = 0; i < N; i++) {
      for (var j = 0; j <= i; j++) {
        var sum = A[i][j];
        for (var k = 0; k < j; k++) {
          sum -= L[i][k] * L[j][k];
        }
        if (i == j) {
          if (sum <= 0.0 || Double.isNaN(sum)) {
            return null;
          }
          L[i][i] = Math.sqrt(sum);
        } else {
          L[i][j] = sum / L[j][j];
        }
      }
    }
    return L;
  }

  private record PreparedProfile(List<PreparedComponent> components, double[] cumulativeWeights) {}

  private record PreparedComponent(double[] means, double[] stddevs, double[][] cholesky) {}
}
