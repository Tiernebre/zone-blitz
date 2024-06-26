package com.tiernebre.web.controllers.authentication;

import com.tiernebre.authentication.registration.CreateRegistrationRequest;
import com.tiernebre.authentication.registration.RegistrationAuthenticationRequest;
import com.tiernebre.authentication.registration.RegistrationAuthenticationStrategy;
import com.tiernebre.authentication.registration.RegistrationService;
import com.tiernebre.web.templates.Registration;
import com.tiernebre.web.util.SessionRegistry;
import com.tiernebre.web.util.WebHelper;
import io.javalin.http.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class RegistrationController {

  private final Logger LOG = LoggerFactory.getLogger(
    RegistrationController.class
  );

  private final RegistrationService service;
  private final RegistrationAuthenticationStrategy authenticationStrategy;
  private final SessionRegistry sessionRegister;
  private final WebHelper helper;

  public RegistrationController(
    RegistrationService service,
    RegistrationAuthenticationStrategy authenticationStrategy,
    SessionRegistry sessionRegister,
    WebHelper helper
  ) {
    this.service = service;
    this.authenticationStrategy = authenticationStrategy;
    this.sessionRegister = sessionRegister;
    this.helper = helper;
  }

  public void submit(Context ctx) {
    var password = ctx.formParam(AuthenticationWebConstants.PASSWORD_PARAMETER);
    service
      .create(
        new CreateRegistrationRequest(
          ctx.formParam(AuthenticationWebConstants.USERNAME_PARAMETER),
          password,
          ctx.formParam(AuthenticationWebConstants.CONFIRM_PASSWORD_PARAMETER)
        )
      )
      .map(
        registration ->
          new RegistrationAuthenticationRequest(
            registration.username(),
            password
          )
      )
      .flatMap(authenticationStrategy::authenticate)
      .peek(session -> {
        sessionRegister.register(ctx, session);
        ctx.redirect("/");
        LOG.debug("Successful registration, redirecting to home page");
      })
      .peekLeft(error -> {
        ctx.status(error.httpStatus());
        LOG.debug("Failed registration, got error {}", error);
        page(ctx, error.publicMessage());
      });
  }

  public void render(Context ctx) {
    page(ctx, null);
  }

  private void page(Context ctx, String error) {
    helper.template(ctx, new Registration(error));
    AuthenticationWebControllerHelper.allowGoogleScript(ctx);
  }
}
