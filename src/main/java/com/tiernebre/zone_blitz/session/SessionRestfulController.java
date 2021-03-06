package com.tiernebre.zone_blitz.session;

import com.tiernebre.zone_blitz.authentication.IsAuthenticated;
import com.tiernebre.zone_blitz.token.access.GenerateAccessTokenException;
import com.tiernebre.zone_blitz.token.refresh.RefreshTokenConfigurationProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletResponse;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static com.tiernebre.zone_blitz.authentication.SessionCookieNames.FINGERPRINT_COOKIE_NAME;
import static com.tiernebre.zone_blitz.authentication.SessionCookieNames.REFRESH_TOKEN_COOKIE_NAME;

@RestController
@RequiredArgsConstructor
@RequestMapping("/sessions")
public class SessionRestfulController {

    private final SessionService service;
    private final RefreshTokenConfigurationProperties refreshTokenConfigurationProperties;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto createOne(
            @RequestBody CreateSessionRequest createSessionRequest,
            HttpServletResponse httpServletResponse
    ) throws GenerateAccessTokenException, UserNotFoundForSessionException, InvalidCreateSessionRequestException {
        SessionDto createdSession = service.createOne(createSessionRequest);
        setCookiesForSession(createdSession, httpServletResponse);
        return createdSession;
    }

    @IsAuthenticated
    @PutMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto refreshOne(
            @CookieValue(REFRESH_TOKEN_COOKIE_NAME) UUID refreshToken,
            HttpServletResponse httpServletResponse
    ) throws GenerateAccessTokenException, InvalidRefreshSessionRequestException {
        SessionDto refreshedSession = service.refreshOne(refreshToken);
        setCookiesForSession(refreshedSession, httpServletResponse);
        return refreshedSession;
    }

    private void setCookiesForSession(SessionDto session, HttpServletResponse httpServletResponse) {
        httpServletResponse.addCookie(createRefreshTokenCookie(session));
        httpServletResponse.addCookie(createFingerprintCookie(session));
    }

    private Cookie createRefreshTokenCookie(SessionDto session) {
        Cookie refreshTokenCookie = new Cookie(REFRESH_TOKEN_COOKIE_NAME, session.getRefreshToken().toString());
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setMaxAge(getRefreshTokenCookieAgeInSeconds());
        return refreshTokenCookie;
    }

    private Cookie createFingerprintCookie(SessionDto session) {
        Cookie fingerprintCookie = new Cookie(FINGERPRINT_COOKIE_NAME, session.getFingerprint());
        fingerprintCookie.setHttpOnly(true);
        return fingerprintCookie;
    }

    private int getRefreshTokenCookieAgeInSeconds() {
        return Math.toIntExact(TimeUnit.MINUTES.toSeconds(refreshTokenConfigurationProperties.getExpirationWindowInMinutes()));
    }
}
