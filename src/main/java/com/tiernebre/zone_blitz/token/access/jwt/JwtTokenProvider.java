package com.tiernebre.zone_blitz.token.access.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.tiernebre.zone_blitz.token.access.AccessTokenDto;
import com.tiernebre.zone_blitz.token.access.AccessTokenInvalidException;
import com.tiernebre.zone_blitz.token.access.AccessTokenProvider;
import com.tiernebre.zone_blitz.token.access.GenerateAccessTokenException;
import com.tiernebre.zone_blitz.token.access.fingerprint.AccessTokenFingerprintGenerator;
import com.tiernebre.zone_blitz.token.access.fingerprint.AccessTokenFingerprintHasher;
import com.tiernebre.zone_blitz.user.dto.UserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Date;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import static com.tiernebre.zone_blitz.token.access.jwt.JwtTokenConstants.*;

/**
 * Generates / Validates JSON Web Tokens.
 */
@Component
@RequiredArgsConstructor
public class JwtTokenProvider implements AccessTokenProvider {
    private final Algorithm algorithm;
    private final JwtTokenConfigurationProperties configurationProperties;
    private final Clock clock;
    private final AccessTokenFingerprintHasher fingerprintHasher;
    private final AccessTokenFingerprintGenerator fingerprintGenerator;

    @Override
    public AccessTokenDto generateOne(UserDto user) throws GenerateAccessTokenException {
        Objects.requireNonNull(user, NULL_USER_ERROR_MESSAGE);

        try {
            String fingerprint = fingerprintGenerator.generateOne();
            String accessToken = JWT.create()
                    .withIssuer(ISSUER)
                    .withSubject(user.getId().toString())
                    .withClaim(EMAIL_CLAIM, user.getEmail())
                    .withClaim(IS_CONFIRMED_CLAIM, user.isConfirmed())
                    .withClaim(FINGERPRINT_CLAIM, fingerprintHasher.hashFingerprint(fingerprint))
                    .withExpiresAt(generateExpiresAt())
                    .sign(algorithm);
            return AccessTokenDto.builder()
                    .token(accessToken)
                    .fingerprint(fingerprint)
                    .build();
        } catch (Exception exception){
            throw new GenerateAccessTokenException(exception.getMessage());
        }
    }

    @Override
    public UserDto validateOne(String token, String fingerprint) throws AccessTokenInvalidException {
        try {
            Objects.requireNonNull(token);
            Objects.requireNonNull(fingerprint);

            JWTVerifier verifier = JWT.require(algorithm)
                    .withIssuer(ISSUER)
                    .withClaim(FINGERPRINT_CLAIM, fingerprintHasher.hashFingerprint(fingerprint))
                    .build();
            DecodedJWT decodedJWT = verifier.verify(token);
            return mapDecodedJWTToUser(decodedJWT);
        } catch (Exception e) {
            throw new AccessTokenInvalidException();
        }
    }

    private UserDto mapDecodedJWTToUser(DecodedJWT decodedJWT) {
        return UserDto.builder()
                .id(Long.parseLong(decodedJWT.getSubject()))
                .email(decodedJWT.getClaim(EMAIL_CLAIM).asString())
                .isConfirmed(decodedJWT.getClaim(IS_CONFIRMED_CLAIM).asBoolean())
                .build();
    }

    private Date generateExpiresAt() {
        return new Date(clock.millis() + TimeUnit.MINUTES.toMillis(configurationProperties.getExpirationWindowInMinutes()));
    }
}
