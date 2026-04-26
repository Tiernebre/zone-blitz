package app.zoneblitz.gamesimulator.roster;

/**
 * Fluent builder for {@link Tendencies} in test code. Defaults to all-50 (matchup-neutral); {@code
 * with*} methods override individual axes.
 */
public final class TendenciesBuilder {

  private int composure = 50;
  private int discipline = 50;
  private int footballIq = 50;
  private int processing = 50;
  private int toughness = 50;
  private int clutch = 50;
  private int consistency = 50;
  private int motor = 50;
  private int playRecognition = 50;

  public static TendenciesBuilder aTendencies() {
    return new TendenciesBuilder();
  }

  public TendenciesBuilder withComposure(int v) {
    this.composure = v;
    return this;
  }

  public TendenciesBuilder withDiscipline(int v) {
    this.discipline = v;
    return this;
  }

  public TendenciesBuilder withFootballIq(int v) {
    this.footballIq = v;
    return this;
  }

  public TendenciesBuilder withProcessing(int v) {
    this.processing = v;
    return this;
  }

  public TendenciesBuilder withToughness(int v) {
    this.toughness = v;
    return this;
  }

  public TendenciesBuilder withClutch(int v) {
    this.clutch = v;
    return this;
  }

  public TendenciesBuilder withConsistency(int v) {
    this.consistency = v;
    return this;
  }

  public TendenciesBuilder withMotor(int v) {
    this.motor = v;
    return this;
  }

  public TendenciesBuilder withPlayRecognition(int v) {
    this.playRecognition = v;
    return this;
  }

  public Tendencies build() {
    return new Tendencies(
        composure,
        discipline,
        footballIq,
        processing,
        toughness,
        clutch,
        consistency,
        motor,
        playRecognition);
  }
}
