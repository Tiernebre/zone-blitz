package app.zoneblitz.gamesimulator.roster;

/**
 * Fluent builder for {@link Physical} in test code. Defaults to all-50 (matchup-neutral); {@code
 * with*} methods override individual axes.
 */
public final class PhysicalBuilder {

  private int speed = 50;
  private int acceleration = 50;
  private int agility = 50;
  private int strength = 50;
  private int power = 50;
  private int bend = 50;
  private int stamina = 50;
  private int explosiveness = 50;

  public static PhysicalBuilder aPhysical() {
    return new PhysicalBuilder();
  }

  public PhysicalBuilder withSpeed(int v) {
    this.speed = v;
    return this;
  }

  public PhysicalBuilder withAcceleration(int v) {
    this.acceleration = v;
    return this;
  }

  public PhysicalBuilder withAgility(int v) {
    this.agility = v;
    return this;
  }

  public PhysicalBuilder withStrength(int v) {
    this.strength = v;
    return this;
  }

  public PhysicalBuilder withPower(int v) {
    this.power = v;
    return this;
  }

  public PhysicalBuilder withBend(int v) {
    this.bend = v;
    return this;
  }

  public PhysicalBuilder withStamina(int v) {
    this.stamina = v;
    return this;
  }

  public PhysicalBuilder withExplosiveness(int v) {
    this.explosiveness = v;
    return this;
  }

  public Physical build() {
    return new Physical(
        speed, acceleration, agility, strength, power, bend, stamina, explosiveness);
  }
}
