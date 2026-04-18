package app.zoneblitz.names;

import java.util.Objects;

/** A generated human name. */
public record Name(String first, String last) {

  public Name {
    Objects.requireNonNull(first, "first");
    Objects.requireNonNull(last, "last");
    if (first.isBlank()) {
      throw new IllegalArgumentException("first must not be blank");
    }
    if (last.isBlank()) {
      throw new IllegalArgumentException("last must not be blank");
    }
  }

  /** Space-joined display form, e.g. {@code "Marcus Alvarez"}. */
  public String display() {
    return first + " " + last;
  }
}
