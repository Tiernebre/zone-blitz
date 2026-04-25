package app.zoneblitz.gamesimulator.roster;

/**
 * Fluent builder for {@link Skill} in test code. Defaults to all-50 (matchup-neutral); {@code
 * with*} methods override individual axes.
 */
public final class SkillBuilder {

  private int passSet = 50;
  private int routeRunning = 50;
  private int coverageTechnique = 50;
  private int passRushMoves = 50;
  private int blockShedding = 50;
  private int hands = 50;
  private int runBlock = 50;
  private int ballCarrierVision = 50;
  private int breakTackle = 50;
  private int tackling = 50;
  private int kickPower = 50;
  private int kickAccuracy = 50;
  private int puntPower = 50;
  private int puntAccuracy = 50;
  private int puntHangTime = 50;

  public static SkillBuilder aSkill() {
    return new SkillBuilder();
  }

  public SkillBuilder withPassSet(int v) {
    this.passSet = v;
    return this;
  }

  public SkillBuilder withRouteRunning(int v) {
    this.routeRunning = v;
    return this;
  }

  public SkillBuilder withCoverageTechnique(int v) {
    this.coverageTechnique = v;
    return this;
  }

  public SkillBuilder withPassRushMoves(int v) {
    this.passRushMoves = v;
    return this;
  }

  public SkillBuilder withBlockShedding(int v) {
    this.blockShedding = v;
    return this;
  }

  public SkillBuilder withHands(int v) {
    this.hands = v;
    return this;
  }

  public SkillBuilder withRunBlock(int v) {
    this.runBlock = v;
    return this;
  }

  public SkillBuilder withBallCarrierVision(int v) {
    this.ballCarrierVision = v;
    return this;
  }

  public SkillBuilder withBreakTackle(int v) {
    this.breakTackle = v;
    return this;
  }

  public SkillBuilder withTackling(int v) {
    this.tackling = v;
    return this;
  }

  public SkillBuilder withKickPower(int v) {
    this.kickPower = v;
    return this;
  }

  public SkillBuilder withKickAccuracy(int v) {
    this.kickAccuracy = v;
    return this;
  }

  public SkillBuilder withPuntPower(int v) {
    this.puntPower = v;
    return this;
  }

  public SkillBuilder withPuntAccuracy(int v) {
    this.puntAccuracy = v;
    return this;
  }

  public SkillBuilder withPuntHangTime(int v) {
    this.puntHangTime = v;
    return this;
  }

  public Skill build() {
    return new Skill(
        passSet,
        routeRunning,
        coverageTechnique,
        passRushMoves,
        blockShedding,
        hands,
        runBlock,
        ballCarrierVision,
        breakTackle,
        tackling,
        kickPower,
        kickAccuracy,
        puntPower,
        puntAccuracy,
        puntHangTime);
  }
}
