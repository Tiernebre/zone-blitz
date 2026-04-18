package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** Test double: replays a scripted sequence of {@link PlayCaller.PlayCall}s. */
final class ScriptedPlayCaller implements PlayCaller {

  private final List<PlayCall> script;
  private final AtomicInteger cursor = new AtomicInteger();

  ScriptedPlayCaller(List<PlayCall> script) {
    this.script = List.copyOf(script);
  }

  static ScriptedPlayCaller runs(int count) {
    return new ScriptedPlayCaller(
        java.util.stream.IntStream.range(0, count).mapToObj(i -> new PlayCall("run")).toList());
  }

  @Override
  public PlayCall call(GameState state, Coach offensiveCoach, RandomSource rng) {
    var i = cursor.getAndIncrement();
    return script.get(i % script.size());
  }
}
