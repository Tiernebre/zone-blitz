package com.tiernebre.zone_blitz.password;

import com.tiernebre.zone_blitz.jooq.tables.records.UserRecord;
import com.tiernebre.zone_blitz.mail.ZoneBlitzEmailConfigurationProperties;
import com.tiernebre.zone_blitz.test.AbstractIntegrationTestingSuite;
import com.tiernebre.zone_blitz.test.email.TestEmail;
import com.tiernebre.zone_blitz.test.email.TestEmailInboxService;
import com.tiernebre.zone_blitz.test.email.TestEmailSearchOption;
import com.tiernebre.zone_blitz.user.UserRecordPool;
import com.tiernebre.zone_blitz.user.dto.UserDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.platform.commons.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class PasswordResetTokenEmailDeliveryServiceIntegrationTests extends AbstractIntegrationTestingSuite {
    @Autowired
    private PasswordResetTokenEmailDeliveryService passwordResetTokenEmailDeliveryService;

    @Autowired
    private UserRecordPool userRecordPool;

    @Autowired
    private TestEmailInboxService testEmailInboxService;

    @Autowired
    private ZoneBlitzEmailConfigurationProperties zoneBlitzEmailConfigurationProperties;

    @Autowired
    private PasswordResetEmailDeliveryConfigurationProperties passwordResetEmailDeliveryConfigurationProperties;

    @Nested
    @DisplayName("sendOne")
    public class SendOneTests {
        @Test
        @DisplayName("sends an email to an inbox")
        public void sendsAnEmailToAnInbox() {
            UserRecord userToResetPasswordFor = userRecordPool.createAndSaveOne();
            UserDto userToResetPasswordForAsDto = UserDto.builder()
                    .id(userToResetPasswordFor.getId())
                    .email(userToResetPasswordFor.getEmail())
                    .build();
            UUID passwordResetToken = UUID.randomUUID();
            passwordResetTokenEmailDeliveryService.sendOne(userToResetPasswordForAsDto, passwordResetToken);
            TestEmail foundEmail = testEmailInboxService.searchForEmail(
                    TestEmailSearchOption.TO,
                    userToResetPasswordFor.getEmail()
            );
            assertTrue(StringUtils.isNotBlank(foundEmail.getFrom()));
            assertTrue(StringUtils.isNotBlank(foundEmail.getTo()));
            assertTrue(StringUtils.isNotBlank(foundEmail.getSubject()));
            assertTrue(StringUtils.isNotBlank(foundEmail.getText()));
            assertTrue(foundEmail.getText().contains(passwordResetToken.toString()));
            assertEquals(zoneBlitzEmailConfigurationProperties.getFrom(), foundEmail.getFrom());
            assertEquals(userToResetPasswordFor.getEmail(), foundEmail.getTo());
            assertEquals(passwordResetEmailDeliveryConfigurationProperties.getSubject(), foundEmail.getSubject());
        }
    }
}
