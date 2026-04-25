package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RoleAssignmentTests {

  private static final Player WR = new Player(new PlayerId(new UUID(1L, 1L)), Position.WR, "WR1");
  private static final Player CB = new Player(new PlayerId(new UUID(2L, 2L)), Position.CB, "CB1");

  @Test
  void offensiveAssignment_lookupsByRole() {
    var assignment = new OffensiveRoleAssignment(Map.of(OffensiveRole.X_WR, WR));

    assertThat(assignment.at(OffensiveRole.X_WR)).contains(WR);
    assertThat(assignment.at(OffensiveRole.Z_WR)).isEmpty();
  }

  @Test
  void defensiveAssignment_lookupsByRole() {
    var assignment = new DefensiveRoleAssignment(Map.of(DefensiveRole.OUTSIDE_CB, CB));

    assertThat(assignment.at(DefensiveRole.OUTSIDE_CB)).contains(CB);
    assertThat(assignment.at(DefensiveRole.SLOT_CB)).isEmpty();
  }

  @Test
  void offensiveAssignment_defensivelyCopiesMap() {
    var mutable = new HashMap<OffensiveRole, Player>();
    mutable.put(OffensiveRole.X_WR, WR);
    var assignment = new OffensiveRoleAssignment(mutable);

    mutable.clear();

    assertThat(assignment.at(OffensiveRole.X_WR)).contains(WR);
  }

  @Test
  void roleAssignmentInterface_lookupViaParentTypeWorks() {
    RoleAssignment offensive = new OffensiveRoleAssignment(Map.of(OffensiveRole.X_WR, WR));

    assertThat(offensive.playerAt(OffensiveRole.X_WR)).contains(WR);
    assertThat(offensive.playerAt(OffensiveRole.Z_WR)).isEmpty();
  }

  @Test
  void pairing_requiresBothSides() {
    var off = new OffensiveRoleAssignment(Map.of());
    var def = new DefensiveRoleAssignment(Map.of());
    var pair = new RoleAssignmentPair(off, def);

    assertThat(pair.offense()).isEqualTo(off);
    assertThat(pair.defense()).isEqualTo(def);

    assertThatThrownBy(() -> new RoleAssignmentPair(null, def))
        .isInstanceOf(NullPointerException.class);
  }
}
