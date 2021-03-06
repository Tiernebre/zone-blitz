package com.tiernebre.zone_blitz.user.service;

import com.tiernebre.zone_blitz.jooq.tables.records.UserRecord;
import com.tiernebre.zone_blitz.mail.ZoneBlitzEmailConfigurationProperties;
import com.tiernebre.zone_blitz.test.AbstractIntegrationTestingSuite;
import com.tiernebre.zone_blitz.test.email.TestEmail;
import com.tiernebre.zone_blitz.test.email.TestEmailInboxService;
import com.tiernebre.zone_blitz.test.email.TestEmailSearchOption;
import com.tiernebre.zone_blitz.user.UserRecordPool;
import com.tiernebre.zone_blitz.user.configuration.UserEmailConfirmationConfigurationProperties;
import com.tiernebre.zone_blitz.user.dto.UserDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.platform.commons.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.Assert.*;

public class UserEmailConfirmationServiceIntegrationTests extends AbstractIntegrationTestingSuite {
    @Autowired
    private UserEmailConfirmationService userEmailConfirmationService;

    @Autowired
    private UserRecordPool userRecordPool;

    @Autowired
    private TestEmailInboxService testEmailInboxService;

    @Autowired
    private ZoneBlitzEmailConfigurationProperties zoneBlitzEmailConfigurationProperties;

    @Autowired
    private UserEmailConfirmationConfigurationProperties userEmailConfirmationConfigurationProperties;

    @Nested
    @DisplayName("sendOne")
    public class SendOneTests {
        @Test
        @DisplayName("sends an email to an inbox")
        public void sendsAnEmailToAnInbox() {
            UserRecord userToConfirm = userRecordPool.createAndSaveOne();
            UserDto userToConfirmAsDto = UserDto.builder()
                    .id(userToConfirm.getId())
                    .email(userToConfirm.getEmail())
                    .build();
            userEmailConfirmationService.sendOne(userToConfirmAsDto);
            TestEmail foundEmail = testEmailInboxService.searchForEmail(
                    TestEmailSearchOption.TO,
                    userToConfirm.getEmail()
            );
            assertTrue(StringUtils.isNotBlank(foundEmail.getFrom()));
            assertTrue(StringUtils.isNotBlank(foundEmail.getTo()));
            assertTrue(StringUtils.isNotBlank(foundEmail.getSubject()));
            assertTrue(StringUtils.isNotBlank(foundEmail.getText()));
            assertEquals(zoneBlitzEmailConfigurationProperties.getFrom(), foundEmail.getFrom());
            assertEquals(userToConfirm.getEmail(), foundEmail.getTo());
            assertEquals(userEmailConfirmationConfigurationProperties.getSubject(), foundEmail.getSubject());
        }
    }
}
