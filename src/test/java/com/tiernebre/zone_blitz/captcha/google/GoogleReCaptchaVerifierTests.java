package com.tiernebre.zone_blitz.captcha.google;

import com.tiernebre.zone_blitz.captcha.CaptchaIsNotValidException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class GoogleReCaptchaVerifierTests {
    @InjectMocks
    private GoogleReCaptchaVerifier googleReCaptchaVerifier;

    @Mock
    private RestTemplate googleReCaptchaRestTemplate;

    @Mock
    private GoogleReCaptchaConfigurationProperties googleReCaptchaConfigurationProperties;

    @Nested
    @DisplayName("verify")
    class VerifyTests {
        @Test
        @DisplayName("does not throw any errors if the captcha token is valid and has a score higher than the minimum allowed")
        void doesNotThrowAnyErrorsIfTheCaptchaTokenIsValidAndHasScoreHigherThanMinimumAllowed() {
            String secret = UUID.randomUUID().toString();
            when(googleReCaptchaConfigurationProperties.getSecret()).thenReturn(secret);
            when(googleReCaptchaConfigurationProperties.getMinimumAllowedScore()).thenReturn(BigDecimal.ZERO);
            String captchaToken = UUID.randomUUID().toString();
            GoogleReCaptchaVerificationResponse mockedGoogleResponse = GoogleReCaptchaVerificationResponseFactory.generateOneDto();
            when(googleReCaptchaRestTemplate.postForObject(
                    eq("/siteverify?secret={secret}&response={response}"),
                    isNull(),
                    eq(GoogleReCaptchaVerificationResponse.class),
                    eq(secret),
                    eq(captchaToken)
            )).thenReturn(mockedGoogleResponse);
            assertDoesNotThrow(() -> googleReCaptchaVerifier.verify(captchaToken));
        }

        @Test
        @DisplayName("does not throw any errors if the captcha token is valid and has a score that is the exact same as the minimum allowed score")
        void doesNotThrowAnyErrorsIfTheCaptchaTokenIsValidAndHasScoreThatIsThatIsTheExactSameAsTheMinimumAllowedScore() {
            BigDecimal minimumAllowedScore = BigDecimal.valueOf(0.25);
            String secret = UUID.randomUUID().toString();
            when(googleReCaptchaConfigurationProperties.getSecret()).thenReturn(secret);
            when(googleReCaptchaConfigurationProperties.getMinimumAllowedScore()).thenReturn(minimumAllowedScore);
            String captchaToken = UUID.randomUUID().toString();
            GoogleReCaptchaVerificationResponse mockedGoogleResponse = GoogleReCaptchaVerificationResponseFactory.generateOneDto(true, minimumAllowedScore);
            when(googleReCaptchaRestTemplate.postForObject(
                    eq("/siteverify?secret={secret}&response={response}"),
                    isNull(),
                    eq(GoogleReCaptchaVerificationResponse.class),
                    eq(secret),
                    eq(captchaToken)
            )).thenReturn(mockedGoogleResponse);
            assertDoesNotThrow(() -> googleReCaptchaVerifier.verify(captchaToken));
        }

        @Test
        @DisplayName("throws not valid captcha error if the captcha token is invalid")
        void throwsNotValidCaptchaErrorIfTheCaptchaTokenIsInvalid() {
            String secret = UUID.randomUUID().toString();
            when(googleReCaptchaConfigurationProperties.getSecret()).thenReturn(secret);
            String captchaToken = UUID.randomUUID().toString();
            GoogleReCaptchaVerificationResponse mockedGoogleResponse = GoogleReCaptchaVerificationResponseFactory.generateOneDto(false, BigDecimal.ONE);
            when(googleReCaptchaRestTemplate.postForObject(
                    eq("/siteverify?secret={secret}&response={response}"),
                    isNull(),
                    eq(GoogleReCaptchaVerificationResponse.class),
                    eq(secret),
                    eq(captchaToken)
            )).thenReturn(mockedGoogleResponse);
            assertThrows(
                    CaptchaIsNotValidException.class,
                    () -> googleReCaptchaVerifier.verify(captchaToken)
            );
        }

        @Test
        @DisplayName("throws not valid captcha error if the captcha token is valid, but had a low score")
        void throwsNotValidCaptchaErrorIfTheCaptchaTokenIsValidButHadALowScore() {
            String secret = UUID.randomUUID().toString();
            when(googleReCaptchaConfigurationProperties.getSecret()).thenReturn(secret);
            when(googleReCaptchaConfigurationProperties.getMinimumAllowedScore()).thenReturn(BigDecimal.ONE);
            String captchaToken = UUID.randomUUID().toString();
            GoogleReCaptchaVerificationResponse mockedGoogleResponse = GoogleReCaptchaVerificationResponseFactory.generateOneDto(true, BigDecimal.ZERO);
            when(googleReCaptchaRestTemplate.postForObject(
                    eq("/siteverify?secret={secret}&response={response}"),
                    isNull(),
                    eq(GoogleReCaptchaVerificationResponse.class),
                    eq(secret),
                    eq(captchaToken)
            )).thenReturn(mockedGoogleResponse);
            assertThrows(
                    CaptchaIsNotValidException.class,
                    () -> googleReCaptchaVerifier.verify(captchaToken)
            );
        }

        @Test
        @DisplayName("throws not valid captcha error if the rest template returns null")
        void throwsNotValidCaptchaErrorIfTheRestTemplateReturnsNull() {
            String secret = UUID.randomUUID().toString();
            when(googleReCaptchaConfigurationProperties.getSecret()).thenReturn(secret);
            String captchaToken = UUID.randomUUID().toString();
            when(googleReCaptchaRestTemplate.postForObject(
                    eq("/siteverify?secret={secret}&response={response}"),
                    isNull(),
                    eq(GoogleReCaptchaVerificationResponse.class),
                    eq(secret),
                    eq(captchaToken)
            )).thenReturn(null);
            assertThrows(
                    CaptchaIsNotValidException.class,
                    () -> googleReCaptchaVerifier.verify(captchaToken)
            );
        }
    }
}
