package app.zoneblitz.league;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateLeagueRequest(
    @NotBlank @Size(max = 60) String name, @NotNull Long franchiseId) {

  public CreateLeagueRequest() {
    this("", null);
  }
}
