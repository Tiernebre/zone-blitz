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
  private int armStrength = 50;
  private int shortAccuracy = 50;
  private int deepAccuracy = 50;
  private int pocketPresence = 50;
  private int playAction = 50;
  private int mobility = 50;
  private int carrying = 50;
  private int catching = 50;
  private int passProtection = 50;
  private int release = 50;
  private int contestedCatch = 50;
  private int pressCoverage = 50;
  private int ballSkills = 50;
  private int snapAccuracy = 50;

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

  public SkillBuilder withArmStrength(int v) {
    this.armStrength = v;
    return this;
  }

  public SkillBuilder withShortAccuracy(int v) {
    this.shortAccuracy = v;
    return this;
  }

  public SkillBuilder withDeepAccuracy(int v) {
    this.deepAccuracy = v;
    return this;
  }

  public SkillBuilder withPocketPresence(int v) {
    this.pocketPresence = v;
    return this;
  }

  public SkillBuilder withPlayAction(int v) {
    this.playAction = v;
    return this;
  }

  public SkillBuilder withMobility(int v) {
    this.mobility = v;
    return this;
  }

  public SkillBuilder withCarrying(int v) {
    this.carrying = v;
    return this;
  }

  public SkillBuilder withCatching(int v) {
    this.catching = v;
    return this;
  }

  public SkillBuilder withPassProtection(int v) {
    this.passProtection = v;
    return this;
  }

  public SkillBuilder withRelease(int v) {
    this.release = v;
    return this;
  }

  public SkillBuilder withContestedCatch(int v) {
    this.contestedCatch = v;
    return this;
  }

  public SkillBuilder withPressCoverage(int v) {
    this.pressCoverage = v;
    return this;
  }

  public SkillBuilder withBallSkills(int v) {
    this.ballSkills = v;
    return this;
  }

  public SkillBuilder withSnapAccuracy(int v) {
    this.snapAccuracy = v;
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
        puntHangTime,
        armStrength,
        shortAccuracy,
        deepAccuracy,
        pocketPresence,
        playAction,
        mobility,
        carrying,
        catching,
        passProtection,
        release,
        contestedCatch,
        pressCoverage,
        ballSkills,
        snapAccuracy);
  }
}
