package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import java.util.Objects;
import java.util.Optional;

/** Run-shaped resolution results produced by a {@link RunResolver}. */
public sealed interface RunOutcome extends PlayOutcome permits RunOutcome.Run {

  /** A designed rushing play. */
  record Run(
      PlayerId carrier,
      RunConcept concept,
      int yards,
      Optional<PlayerId> tackler,
      Optional<FumbleOutcome> fumble,
      boolean touchdown,
      boolean firstDown)
      implements RunOutcome {
    public Run {
      Objects.requireNonNull(carrier, "carrier");
      Objects.requireNonNull(concept, "concept");
      Objects.requireNonNull(tackler, "tackler");
      Objects.requireNonNull(fumble, "fumble");
    }
  }
}
