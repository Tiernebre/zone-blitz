package com.tiernebre.web.controllers.authentication;

import com.tiernebre.web.util.SessionRegistry;
import com.tiernebre.web.util.WebHelper;
import io.javalin.http.Context;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import org.jetbrains.annotations.NotNull;

public final class LogoutController implements Handler {

  private final SessionRegistry sessionRegister;
  private final WebHelper helper;

  public LogoutController(SessionRegistry sessionRegister, WebHelper helper) {
    this.sessionRegister = sessionRegister;
    this.helper = helper;
  }

  @Override
  public void handle(@NotNull Context ctx) throws Exception {
    helper.session(ctx).peek(session -> sessionRegister.delete(ctx, session));
    ctx.status(HttpStatus.OK);
    ctx.redirect("/");
  }
}
