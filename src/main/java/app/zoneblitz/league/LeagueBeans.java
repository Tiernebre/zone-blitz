package app.zoneblitz.league;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wiring for league-feature beans that are not themselves {@code @Component}-annotated. */
@Configuration
class LeagueBeans {

  @Bean
  CandidateGenerator headCoachGenerator() {
    return new HeadCoachGenerator();
  }
}
