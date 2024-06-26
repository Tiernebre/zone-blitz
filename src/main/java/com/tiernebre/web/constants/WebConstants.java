package com.tiernebre.web.constants;

import java.time.Duration;

public final class WebConstants {

  public static final String URL = System.getenv("ZONE_BLITZ_URL");
  public static final String CONTENT_SECURITY_POLICY = System.getenv(
    "ZONE_BLITZ_CONTENT_SECURITY_POLICY"
  );
  public static final String CONTENT_SECURITY_POLICY_HEADER_NAME =
    "Content-Security-Policy";
  public static final String JAVALIN_SESSION_ATTRIBUTE = "SESSION";
  public static final String SESSION_COOKIE_TOKEN_NAME = "zb_session_id";
  public static final String REQUESTED_PATH_COOKIE_NAME = "zb_requested_path";
  public static final Duration SESSION_REFRESH_WINDOW = Duration.ofMinutes(10);

  public static final String LOGGED_OUT_QUERY_PARAM = "unauthenticated";
}
