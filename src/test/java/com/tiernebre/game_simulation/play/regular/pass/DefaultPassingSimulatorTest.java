package com.tiernebre.game_simulation.play.regular.pass;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.tiernebre.game_simulation.personnel.defense.RegularPlayDefensivePersonnel;
import com.tiernebre.game_simulation.personnel.offense.RegularPlayOffensivePersonnel;
import com.tiernebre.game_simulation.play.regular.RegularPlaySimulatorMockFactory;
import com.tiernebre.game_simulation.play.regular.defense.TackledByCalculator;
import com.tiernebre.game_simulation.play.regular.pass.completion.CompletedPassCalculator;
import com.tiernebre.game_simulation.play.regular.pass.interception.InterceptionCalculator;
import com.tiernebre.game_simulation.play.regular.pass.interception.InterceptionResult;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

public class DefaultPassingSimulatorTest {

  @Test
  public void returnsAPassResult() {
    var passingYardageCalculator = Mockito.mock(PassingYardageCalculator.class);
    var completedPassCalculator = Mockito.mock(CompletedPassCalculator.class);
    var interceptionCalculator = Mockito.mock(InterceptionCalculator.class);
    var tackledByCalculator = Mockito.mock(TackledByCalculator.class);
    var yards = 10;
    var completed = true;
    var arguments = RegularPlaySimulatorMockFactory.arguments();
    var tackledBy = arguments.defensivePersonnel().cornerbacks()[0];
    when(passingYardageCalculator.calculate(any())).thenReturn(yards);
    when(completedPassCalculator.completed(any())).thenReturn(completed);
    when(interceptionCalculator.intercepted(any())).thenReturn(false);
    when(
      tackledByCalculator.tackledBy(any(RegularPlayDefensivePersonnel.class))
    ).thenReturn(tackledBy);
    var simulator = new DefaultPassingSimulator(
      passingYardageCalculator,
      completedPassCalculator,
      interceptionCalculator,
      tackledByCalculator
    );
    var result = simulator.simulate(arguments);
    assertTrue(result instanceof PassResult);
    var passResult = (PassResult) result;
    assertEquals(yards, passResult.yards());
    assertEquals(completed, passResult.completed());
    assertEquals(arguments.offensiveDecision().target(), passResult.target());
    assertEquals(tackledBy, passResult.tackledBy());
  }

  @Test
  public void returnsAnInterceptionResult() {
    var passingYardageCalculator = Mockito.mock(PassingYardageCalculator.class);
    var completedPassCalculator = Mockito.mock(CompletedPassCalculator.class);
    var interceptionCalculator = Mockito.mock(InterceptionCalculator.class);
    var tackledByCalculator = Mockito.mock(TackledByCalculator.class);
    var arguments = RegularPlaySimulatorMockFactory.arguments();
    var tackledBy = arguments.offensiveDecision().personnel().center();
    when(interceptionCalculator.intercepted(any())).thenReturn(true);
    when(
      tackledByCalculator.tackledBy(any(RegularPlayOffensivePersonnel.class))
    ).thenReturn(tackledBy);
    var simulator = new DefaultPassingSimulator(
      passingYardageCalculator,
      completedPassCalculator,
      interceptionCalculator,
      tackledByCalculator
    );
    var result = simulator.simulate(arguments);
    assertTrue(result instanceof InterceptionResult);
    var interceptionResult = (InterceptionResult) result;
    assertEquals(
      arguments.offensiveDecision().personnel().quarterback(),
      interceptionResult.committedBy()
    );
    assertEquals(tackledBy, interceptionResult.tackledBy());
    assertEquals(0, interceptionResult.yards());
  }
}
