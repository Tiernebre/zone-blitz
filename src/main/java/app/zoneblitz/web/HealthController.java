package app.zoneblitz.web;

import org.jooq.DSLContext;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HealthController {

  private final DSLContext dsl;

  public HealthController(DSLContext dsl) {
    this.dsl = dsl;
  }

  @GetMapping("/api/health")
  public String health(Model model) {
    boolean dbUp;
    try {
      dbUp = dsl.selectOne().fetchOne() != null;
    } catch (RuntimeException e) {
      dbUp = false;
    }
    model.addAttribute("dbUp", dbUp);
    return "fragments/health :: health";
  }
}
