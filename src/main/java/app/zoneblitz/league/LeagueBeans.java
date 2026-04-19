package app.zoneblitz.league;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wiring for league-feature beans that are not themselves {@code @Component}-annotated. */
@Configuration
class LeagueBeans {

  @Bean
  HeadCoachGenerator headCoachGenerator() {
    return new HeadCoachGenerator();
  }

  @Bean
  DirectorOfScoutingGenerator directorOfScoutingGenerator() {
    return new DirectorOfScoutingGenerator();
  }

  @Bean
  CoordinatorGenerator coordinatorGenerator() {
    return new CoordinatorGenerator();
  }

  @Bean
  PositionCoachGenerator positionCoachGenerator() {
    return new PositionCoachGenerator();
  }

  @Bean
  ScoutCandidateGenerator scoutCandidateGenerator() {
    return new ScoutCandidateGenerator();
  }

  @Bean
  CpuTeamStrategy headCoachCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      CandidateRandomSources rngs) {
    return new CpuHiringStrategy(
        LeaguePhase.HIRING_HEAD_COACH,
        CandidatePoolType.HEAD_COACH,
        pools,
        candidates,
        preferences,
        offers,
        hiringStates,
        interviews,
        rngs);
  }

  @Bean
  CpuTeamStrategy directorOfScoutingCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      CandidateRandomSources rngs) {
    return new CpuHiringStrategy(
        LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
        CandidatePoolType.DIRECTOR_OF_SCOUTING,
        pools,
        candidates,
        preferences,
        offers,
        hiringStates,
        interviews,
        rngs);
  }
}
