package app.zoneblitz.league;

import app.zoneblitz.league.hiring.CandidateOfferRepository;
import app.zoneblitz.league.hiring.CandidatePoolRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidatePreferencesRepository;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.CandidateRepository;
import app.zoneblitz.league.hiring.CoordinatorGenerator;
import app.zoneblitz.league.hiring.CpuHiringStrategy;
import app.zoneblitz.league.hiring.DirectorOfScoutingGenerator;
import app.zoneblitz.league.hiring.HeadCoachGenerator;
import app.zoneblitz.league.hiring.PositionCoachGenerator;
import app.zoneblitz.league.hiring.ScoutCandidateGenerator;
import app.zoneblitz.league.hiring.TeamInterviewRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.CpuTeamStrategy;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wiring for league-feature beans that are not themselves {@code @Component}-annotated. */
@Configuration
public class LeagueBeans {

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
