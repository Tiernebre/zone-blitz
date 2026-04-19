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
  CpuFranchiseStrategy headCoachCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      FranchiseHiringStateRepository hiringStates,
      FranchiseInterviewRepository interviews,
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
  CpuFranchiseStrategy directorOfScoutingCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      FranchiseHiringStateRepository hiringStates,
      FranchiseInterviewRepository interviews,
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
