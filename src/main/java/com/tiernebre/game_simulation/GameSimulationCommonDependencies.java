package com.tiernebre.game_simulation;

import com.tiernebre.game_simulation.play.regular.defense.TackledByCalculator;
import com.tiernebre.game_simulation.util.PercentageCalculator;
import java.util.Random;

public record GameSimulationCommonDependencies(
  Random random,
  PercentageCalculator percentageCalculator,
  TackledByCalculator tackledByCalculator
) {}
