package com.tiernebre.web.templates;

import com.tiernebre.web.controllers.authentication.AuthenticationWebConstants;
import com.tiernebre.web.templates.interfaces.UsesForm;
import io.jstach.jstache.JStache;

@JStache(path = "login")
public record Login(String error, String warning) implements UsesForm {
  GoogleSignOnButtonConfiguration google() {
    return AuthenticationWebConstants.GOOGLE_SIGN_ON_BUTTON_CONFIGURATION;
  }

  AuthenticationForm form() {
    return AuthenticationWebConstants.SHARED_AUTHENTICATION_FORM;
  }

  String passwordAutocomplete() {
    return "current-password";
  }
}
