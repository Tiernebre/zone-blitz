package app.zoneblitz.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/",
                        "/error",
                        "/css/**",
                        "/js/**",
                        "/webjars/**",
                        "/favicon.svg",
                        "/actuator/health",
                        "/actuator/info",
                        "/api/health")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2Login(oauth -> oauth.loginPage("/").defaultSuccessUrl("/", true))
        .logout(logout -> logout.logoutSuccessUrl("/").permitAll())
        .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"));
    return http.build();
  }
}
