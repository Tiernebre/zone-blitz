package app.zoneblitz.league;

import app.zoneblitz.league.hiring.CandidateOfferRepository;
import app.zoneblitz.league.hiring.CandidatePoolRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidatePreferencesRepository;
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
import app.zoneblitz.names.CuratedNameGenerator;
import app.zoneblitz.names.NameGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wiring for league-feature beans that are not themselves {@code @Component}-annotated. */
@Configuration
public class LeagueBeans {

  @Bean
  NameGenerator candidateNameGenerator() {
    return CuratedNameGenerator.maleDefaults();
  }

  @Bean
  HeadCoachGenerator headCoachGenerator(NameGenerator names) {
    return new HeadCoachGenerator(names);
  }

  @Bean
  DirectorOfScoutingGenerator directorOfScoutingGenerator(NameGenerator names) {
    return new DirectorOfScoutingGenerator(names);
  }

  @Bean
  CoordinatorGenerator coordinatorGenerator(NameGenerator names) {
    return new CoordinatorGenerator(names);
  }

  @Bean
  PositionCoachGenerator positionCoachGenerator(NameGenerator names) {
    return new PositionCoachGenerator(names);
  }

  @Bean
  ScoutCandidateGenerator scoutCandidateGenerator(NameGenerator names) {
    return new ScoutCandidateGenerator(names);
  }

  @Bean
  CpuTeamStrategy headCoachCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      app.zoneblitz.league.team.TeamProfiles teamProfiles) {
    return new CpuHiringStrategy(
        LeaguePhase.HIRING_HEAD_COACH,
        CandidatePoolType.HEAD_COACH,
        pools,
        candidates,
        preferences,
        offers,
        hiringStates,
        interviews,
        teamProfiles);
  }

  @Bean
  CpuTeamStrategy directorOfScoutingCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      app.zoneblitz.league.team.TeamProfiles teamProfiles) {
    return new CpuHiringStrategy(
        LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
        CandidatePoolType.DIRECTOR_OF_SCOUTING,
        pools,
        candidates,
        preferences,
        offers,
        hiringStates,
        interviews,
        teamProfiles);
  }
}
