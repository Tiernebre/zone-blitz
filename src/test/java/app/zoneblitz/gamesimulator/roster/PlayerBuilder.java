package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.UUID;

/**
 * Fluent builder for {@link Player} in test code. Defaults to a generic mid-tier QB with all
 * attributes at 50; {@code with*} and {@code as*} (shape-preset) methods override.
 *
 * <p>Shape presets (e.g. {@link #asBoxSafety()}, {@link #asScrambler()}) set <em>multiple</em> axes
 * at once to resemble a familiar player archetype. <strong>Test-only convenience</strong> — the
 * runtime has no {@code BoxSafety} or {@code Scrambler} archetype field on {@link Player}; the
 * presets just paint a plausible attribute shape. Production code reads attributes, never labels.
 */
public final class PlayerBuilder {

  private PlayerId id = new PlayerId(UUID.randomUUID());
  private Position position = Position.QB;
  private String displayName = "Test Player";
  private PhysicalBuilder physical = PhysicalBuilder.aPhysical();
  private SkillBuilder skill = SkillBuilder.aSkill();
  private TendenciesBuilder tendencies = TendenciesBuilder.aTendencies();

  public static PlayerBuilder aPlayer() {
    return new PlayerBuilder();
  }

  public PlayerBuilder withId(PlayerId id) {
    this.id = id;
    return this;
  }

  public PlayerBuilder withId(long high, long low) {
    this.id = new PlayerId(new UUID(high, low));
    return this;
  }

  public PlayerBuilder atPosition(Position position) {
    this.position = position;
    return this;
  }

  public PlayerBuilder withDisplayName(String name) {
    this.displayName = name;
    return this;
  }

  public PlayerBuilder withPhysical(PhysicalBuilder physical) {
    this.physical = physical;
    return this;
  }

  public PlayerBuilder withSkill(SkillBuilder skill) {
    this.skill = skill;
    return this;
  }

  public PlayerBuilder withTendencies(TendenciesBuilder tendencies) {
    this.tendencies = tendencies;
    return this;
  }

  public PlayerBuilder withSpeed(int v) {
    physical.withSpeed(v);
    return this;
  }

  public PlayerBuilder withStrength(int v) {
    physical.withStrength(v);
    return this;
  }

  public PlayerBuilder withAgility(int v) {
    physical.withAgility(v);
    return this;
  }

  public PlayerBuilder withTackling(int v) {
    skill.withTackling(v);
    return this;
  }

  public PlayerBuilder withCoverageTechnique(int v) {
    skill.withCoverageTechnique(v);
    return this;
  }

  public PlayerBuilder withRouteRunning(int v) {
    skill.withRouteRunning(v);
    return this;
  }

  public PlayerBuilder withHands(int v) {
    skill.withHands(v);
    return this;
  }

  public PlayerBuilder withPassSet(int v) {
    skill.withPassSet(v);
    return this;
  }

  public PlayerBuilder withRunBlock(int v) {
    skill.withRunBlock(v);
    return this;
  }

  public PlayerBuilder withPassRushMoves(int v) {
    skill.withPassRushMoves(v);
    return this;
  }

  public PlayerBuilder withBlockShedding(int v) {
    skill.withBlockShedding(v);
    return this;
  }

  public PlayerBuilder withProcessing(int v) {
    tendencies.withProcessing(v);
    return this;
  }

  public PlayerBuilder withFootballIq(int v) {
    tendencies.withFootballIq(v);
    return this;
  }

  public PlayerBuilder withArmStrength(int v) {
    skill.withArmStrength(v);
    return this;
  }

  public PlayerBuilder withShortAccuracy(int v) {
    skill.withShortAccuracy(v);
    return this;
  }

  public PlayerBuilder withDeepAccuracy(int v) {
    skill.withDeepAccuracy(v);
    return this;
  }

  public PlayerBuilder withPocketPresence(int v) {
    skill.withPocketPresence(v);
    return this;
  }

  public PlayerBuilder withPlayAction(int v) {
    skill.withPlayAction(v);
    return this;
  }

  public PlayerBuilder withMobility(int v) {
    skill.withMobility(v);
    return this;
  }

  public PlayerBuilder withCarrying(int v) {
    skill.withCarrying(v);
    return this;
  }

  public PlayerBuilder withCatching(int v) {
    skill.withCatching(v);
    return this;
  }

  public PlayerBuilder withPassProtection(int v) {
    skill.withPassProtection(v);
    return this;
  }

  public PlayerBuilder withRelease(int v) {
    skill.withRelease(v);
    return this;
  }

  public PlayerBuilder withContestedCatch(int v) {
    skill.withContestedCatch(v);
    return this;
  }

  public PlayerBuilder withPressCoverage(int v) {
    skill.withPressCoverage(v);
    return this;
  }

  public PlayerBuilder withBallSkills(int v) {
    skill.withBallSkills(v);
    return this;
  }

  public PlayerBuilder withSnapAccuracy(int v) {
    skill.withSnapAccuracy(v);
    return this;
  }

  public PlayerBuilder withPlayRecognition(int v) {
    tendencies.withPlayRecognition(v);
    return this;
  }

  /** Box-shape S: heavy run support, light coverage. Test-only convenience. */
  public PlayerBuilder asBoxSafety() {
    return atPosition(Position.S)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(72)
                .withAcceleration(75)
                .withAgility(65)
                .withStrength(75)
                .withPower(72)
                .withBend(45)
                .withStamina(70)
                .withExplosiveness(70))
        .withSkill(
            SkillBuilder.aSkill()
                .withTackling(82)
                .withBlockShedding(72)
                .withCoverageTechnique(50)
                .withHands(50)
                .withPassRushMoves(55)
                .withBallSkills(48))
        .withTendencies(
            TendenciesBuilder.aTendencies()
                .withToughness(80)
                .withMotor(75)
                .withFootballIq(72)
                .withProcessing(70)
                .withPlayRecognition(75));
  }

  /** Coverage-shape S: deep range, half-field, light run support. Test-only convenience. */
  public PlayerBuilder asRangeSafety() {
    return atPosition(Position.S)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(82)
                .withAcceleration(80)
                .withAgility(75)
                .withStrength(55)
                .withPower(50)
                .withBend(70)
                .withStamina(70)
                .withExplosiveness(75))
        .withSkill(
            SkillBuilder.aSkill()
                .withCoverageTechnique(78)
                .withTackling(58)
                .withBlockShedding(45)
                .withHands(60)
                .withPassRushMoves(35)
                .withBallSkills(75))
        .withTendencies(
            TendenciesBuilder.aTendencies()
                .withFootballIq(75)
                .withProcessing(75)
                .withMotor(70)
                .withPlayRecognition(78));
  }

  /** Pocket-passer QB: high processing/composure, average speed. Test-only convenience. */
  public PlayerBuilder asPocketPasser() {
    return atPosition(Position.QB)
        .withPhysical(
            PhysicalBuilder.aPhysical().withSpeed(50).withAcceleration(50).withAgility(55))
        .withSkill(
            SkillBuilder.aSkill()
                .withArmStrength(72)
                .withShortAccuracy(82)
                .withDeepAccuracy(75)
                .withPocketPresence(82)
                .withPlayAction(72)
                .withMobility(45))
        .withTendencies(
            TendenciesBuilder.aTendencies()
                .withProcessing(82)
                .withFootballIq(82)
                .withComposure(78)
                .withClutch(72));
  }

  /** Scrambler/dual-threat QB: high speed/explosiveness, modest processing. Test-only. */
  public PlayerBuilder asScrambler() {
    return atPosition(Position.QB)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(85)
                .withAcceleration(85)
                .withAgility(78)
                .withExplosiveness(78)
                .withBend(65))
        .withSkill(
            SkillBuilder.aSkill()
                .withArmStrength(78)
                .withShortAccuracy(70)
                .withDeepAccuracy(68)
                .withPocketPresence(60)
                .withPlayAction(65)
                .withMobility(85))
        .withTendencies(
            TendenciesBuilder.aTendencies()
                .withProcessing(65)
                .withFootballIq(65)
                .withComposure(65));
  }

  /** Press-man CB: physicality + route recognition. Test-only convenience. */
  public PlayerBuilder asPressCorner() {
    return atPosition(Position.CB)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(78)
                .withAcceleration(80)
                .withAgility(75)
                .withStrength(62)
                .withBend(70))
        .withSkill(
            SkillBuilder.aSkill()
                .withCoverageTechnique(75)
                .withHands(55)
                .withTackling(60)
                .withPressCoverage(82)
                .withBallSkills(70))
        .withTendencies(
            TendenciesBuilder.aTendencies()
                .withFootballIq(72)
                .withProcessing(72)
                .withComposure(72)
                .withPlayRecognition(70));
  }

  /** Slot WR: separation/agility, hands-heavy. Test-only convenience. */
  public PlayerBuilder asSlot() {
    return atPosition(Position.WR)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(75)
                .withAcceleration(82)
                .withAgility(82)
                .withBend(72)
                .withExplosiveness(75))
        .withSkill(
            SkillBuilder.aSkill()
                .withRouteRunning(78)
                .withHands(75)
                .withBreakTackle(55)
                .withRelease(72)
                .withContestedCatch(60)
                .withCatching(70))
        .withTendencies(TendenciesBuilder.aTendencies().withFootballIq(72).withProcessing(70));
  }

  /** Outside (X/Z) WR: vertical speed + length / route running. Test-only convenience. */
  public PlayerBuilder asOutsideWr() {
    return atPosition(Position.WR)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(85)
                .withAcceleration(82)
                .withAgility(65)
                .withExplosiveness(80))
        .withSkill(
            SkillBuilder.aSkill()
                .withRouteRunning(72)
                .withHands(70)
                .withBreakTackle(55)
                .withRelease(75)
                .withContestedCatch(78)
                .withCatching(65));
  }

  /** Speed-rusher DL: bend + acceleration. Test-only convenience. */
  public PlayerBuilder asSpeedRusher() {
    return atPosition(Position.DL)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(78)
                .withAcceleration(82)
                .withAgility(72)
                .withStrength(65)
                .withBend(78)
                .withExplosiveness(80))
        .withSkill(
            SkillBuilder.aSkill().withPassRushMoves(80).withBlockShedding(58).withTackling(62));
  }

  /** Power-anchor DL: strength + run-defense anchor. Test-only convenience. */
  public PlayerBuilder asPowerAnchor() {
    return atPosition(Position.DL)
        .withPhysical(
            PhysicalBuilder.aPhysical().withSpeed(55).withStrength(85).withPower(82).withBend(50))
        .withSkill(
            SkillBuilder.aSkill().withBlockShedding(78).withTackling(72).withPassRushMoves(55));
  }

  /** Bell-cow RB: power runner. Test-only convenience. */
  public PlayerBuilder asBellCowRb() {
    return atPosition(Position.RB)
        .withPhysical(
            PhysicalBuilder.aPhysical()
                .withSpeed(72)
                .withStrength(78)
                .withPower(78)
                .withExplosiveness(72))
        .withSkill(
            SkillBuilder.aSkill()
                .withBallCarrierVision(78)
                .withBreakTackle(78)
                .withRouteRunning(45)
                .withHands(55)
                .withCarrying(80)
                .withCatching(58)
                .withPassProtection(72));
  }

  public Player build() {
    return new Player(
        id, position, displayName, physical.build(), skill.build(), tendencies.build());
  }
}
