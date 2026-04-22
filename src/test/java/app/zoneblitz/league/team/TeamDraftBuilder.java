package app.zoneblitz.league.team;

import java.util.Optional;

/**
 * Fluent builder for {@link TeamDraft} in test code. Defaults produce a plausible valid instance
 * (franchise id 1, user-owned); {@code with*} methods override individual fields.
 */
final class TeamDraftBuilder {

  private long franchiseId = 1L;
  private Optional<String> ownerSubject = Optional.of("owner-1");

  static TeamDraftBuilder aTeamDraft() {
    return new TeamDraftBuilder();
  }

  TeamDraftBuilder withFranchiseId(long franchiseId) {
    this.franchiseId = franchiseId;
    return this;
  }

  TeamDraftBuilder withOwnerSubject(String ownerSubject) {
    this.ownerSubject = Optional.of(ownerSubject);
    return this;
  }

  TeamDraftBuilder withCpuOwner() {
    this.ownerSubject = Optional.empty();
    return this;
  }

  TeamDraft build() {
    return new TeamDraft(franchiseId, ownerSubject);
  }
}
