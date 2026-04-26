package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Skill;
import java.util.function.ToIntFunction;

/**
 * Axis identifier for the {@link Skill} attributes. Used by {@link RoleDemand} to weight technique
 * contributions per role.
 */
public enum SkillAxis implements AttributeAxis {
  PASS_SET(Skill::passSet),
  ROUTE_RUNNING(Skill::routeRunning),
  COVERAGE_TECHNIQUE(Skill::coverageTechnique),
  PASS_RUSH_MOVES(Skill::passRushMoves),
  BLOCK_SHEDDING(Skill::blockShedding),
  HANDS(Skill::hands),
  RUN_BLOCK(Skill::runBlock),
  BALL_CARRIER_VISION(Skill::ballCarrierVision),
  BREAK_TACKLE(Skill::breakTackle),
  TACKLING(Skill::tackling),
  KICK_POWER(Skill::kickPower),
  KICK_ACCURACY(Skill::kickAccuracy),
  PUNT_POWER(Skill::puntPower),
  PUNT_ACCURACY(Skill::puntAccuracy),
  PUNT_HANG_TIME(Skill::puntHangTime),
  ARM_STRENGTH(Skill::armStrength),
  SHORT_ACCURACY(Skill::shortAccuracy),
  DEEP_ACCURACY(Skill::deepAccuracy),
  POCKET_PRESENCE(Skill::pocketPresence),
  PLAY_ACTION(Skill::playAction),
  MOBILITY(Skill::mobility),
  CARRYING(Skill::carrying),
  CATCHING(Skill::catching),
  PASS_PROTECTION(Skill::passProtection),
  RELEASE(Skill::release),
  CONTESTED_CATCH(Skill::contestedCatch),
  PRESS_COVERAGE(Skill::pressCoverage),
  BALL_SKILLS(Skill::ballSkills),
  SNAP_ACCURACY(Skill::snapAccuracy);

  private final ToIntFunction<Skill> extractor;

  SkillAxis(ToIntFunction<Skill> extractor) {
    this.extractor = extractor;
  }

  public int extract(Skill skill) {
    return extractor.applyAsInt(skill);
  }

  @Override
  public String code() {
    return "SKILL_" + name();
  }

  @Override
  public int extract(Player player) {
    return extract(player.skill());
  }
}
