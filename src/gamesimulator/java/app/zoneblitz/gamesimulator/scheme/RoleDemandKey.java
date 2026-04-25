package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.event.ConceptFamily;
import app.zoneblitz.gamesimulator.role.Role;
import java.util.Objects;

/** Compound key into {@link RoleDemandTable} — role × concept family. */
public record RoleDemandKey(Role role, ConceptFamily concept) {

  public RoleDemandKey {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(concept, "concept");
  }
}
