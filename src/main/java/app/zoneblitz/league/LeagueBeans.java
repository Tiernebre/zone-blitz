package app.zoneblitz.league;

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
}
