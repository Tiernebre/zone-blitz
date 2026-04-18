package app.zoneblitz.names;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;

/**
 * {@link NameGenerator} that samples uniformly from two classpath resources: a pool of first names
 * and a pool of surnames. Pools are loaded once at construction; each line is one entry, blanks and
 * {@code #}-prefixed comments are skipped.
 */
public final class CuratedNameGenerator implements NameGenerator {

  private static final String MALE_FIRST_NAMES = "/names/male_first_names.txt";
  private static final String SURNAMES = "/names/surnames.txt";

  private final List<String> firstNames;
  private final List<String> lastNames;

  public CuratedNameGenerator(List<String> firstNames, List<String> lastNames) {
    Objects.requireNonNull(firstNames, "firstNames");
    Objects.requireNonNull(lastNames, "lastNames");
    if (firstNames.isEmpty()) {
      throw new IllegalArgumentException("firstNames must not be empty");
    }
    if (lastNames.isEmpty()) {
      throw new IllegalArgumentException("lastNames must not be empty");
    }
    this.firstNames = List.copyOf(firstNames);
    this.lastNames = List.copyOf(lastNames);
  }

  /** Factory that loads the bundled male-first and surname pools from the classpath. */
  public static CuratedNameGenerator maleDefaults() {
    return new CuratedNameGenerator(loadResource(MALE_FIRST_NAMES), loadResource(SURNAMES));
  }

  @Override
  public Name generate(RandomSource rng) {
    Objects.requireNonNull(rng, "rng");
    var first = firstNames.get(indexOf(rng, firstNames.size()));
    var last = lastNames.get(indexOf(rng, lastNames.size()));
    return new Name(first, last);
  }

  private static int indexOf(RandomSource rng, int size) {
    return Math.floorMod(rng.nextLong(), size);
  }

  private static List<String> loadResource(String path) {
    try (var stream = CuratedNameGenerator.class.getResourceAsStream(path)) {
      if (stream == null) {
        throw new IllegalStateException("Missing name resource on classpath: " + path);
      }
      try (var reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
        return reader
            .lines()
            .map(String::trim)
            .filter(line -> !line.isEmpty() && !line.startsWith("#"))
            .toList();
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Failed reading name resource: " + path, e);
    }
  }
}
