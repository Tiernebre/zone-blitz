package app.zoneblitz.support;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only authentication seam for Playwright E2E tests. Exposes {@code GET
 * /test-auth/login?sub=…} which stamps an {@link OAuth2AuthenticationToken} into the HTTP session,
 * emulating a completed Google OAuth2 login. The main {@code SecurityFilterChain} keeps working
 * unchanged for every other route.
 */
@TestConfiguration(proxyBeanMethods = false)
public class E2ETestAuth {

  @Bean
  @Order(0)
  SecurityFilterChain testAuthFilterChain(HttpSecurity http) throws Exception {
    http.securityMatcher("/test-auth/**")
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
        .csrf(csrf -> csrf.disable());
    return http.build();
  }

  @RestController
  @RequestMapping("/test-auth")
  static class TestLoginController {

    private final HttpSessionSecurityContextRepository sessionRepository =
        new HttpSessionSecurityContextRepository();

    @GetMapping("/login")
    void login(@RequestParam String sub, HttpServletRequest request, HttpServletResponse response) {
      Map<String, Object> attributes = Map.of("sub", sub, "name", "E2E " + sub);
      var user =
          new DefaultOAuth2User(
              List.of(new SimpleGrantedAuthority("ROLE_USER")), attributes, "sub");
      var authentication = new OAuth2AuthenticationToken(user, user.getAuthorities(), "google");
      var context = SecurityContextHolder.createEmptyContext();
      context.setAuthentication(authentication);
      SecurityContextHolder.setContext(context);
      sessionRepository.saveContext(context, request, response);
    }
  }
}
