package app.zoneblitz.league.hiring;

import app.zoneblitz.league.hiring.candidates.CandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.CandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.CandidateRepository;
import app.zoneblitz.league.hiring.hire.CpuHiringStrategy;
import app.zoneblitz.league.hiring.interview.TeamInterviewRepository;
import app.zoneblitz.league.hiring.offer.CandidateOfferRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.CpuTeamStrategy;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamProfiles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Hiring-feature bean wiring. Keeps hiring-internal concrete references (generators, CPU strategy)
 * out of the parent {@code LeagueBeans}. Generators themselves are {@code @Component}-annotated and
 * are picked up by component-scan; the per-phase {@link CpuHiringStrategy} instances still need
 * {@link Bean} factories because the single concrete class is instantiated twice with different
 * phase arguments.
 */
@Configuration
public class HiringBeans {

  @Bean
  CpuTeamStrategy headCoachCpuHiringStrategy(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      TeamProfiles teamProfiles) {
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
      TeamProfiles teamProfiles) {
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
