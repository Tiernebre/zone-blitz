package com.tiernebre.authentication.registration;

import static com.tiernebre.authentication.AuthenticationConstants.PASSWORD_MAXIMUM_LENGTH;
import static com.tiernebre.authentication.AuthenticationConstants.PASSWORD_MINIMUM_LENGTH;
import static com.tiernebre.authentication.AuthenticationConstants.USERNAME_MAXIMUM_LENGTH;
import static com.tiernebre.util.validation.VavrValidationUtils.matches;
import static com.tiernebre.util.validation.VavrValidationUtils.maximumLength;
import static com.tiernebre.util.validation.VavrValidationUtils.minimumLength;
import static com.tiernebre.util.validation.VavrValidationUtils.required;

import com.tiernebre.util.error.ZoneBlitzError;
import com.tiernebre.util.error.ZoneBlitzValidationError;
import io.vavr.Tuple2;
import io.vavr.collection.Seq;
import io.vavr.collection.Vector;
import io.vavr.control.Either;
import io.vavr.control.Option;
import io.vavr.control.Validation;

public final class VavrRegistrationValidator implements RegistrationValidator {

  private final String USERNAME_FIELD_NAME = "Username";
  private final String PASSWORD_FIELD_NAME = "Password";

  @Override
  public Either<ZoneBlitzError, RegistrationRequest> parse(
    CreateRegistrationRequest request
  ) {
    return Option.of(request)
      .toValidation(
        Seq.narrow(Vector.of("Create registration request is null."))
      )
      .flatMap(
        req ->
          Validation.combine(
            validateUsername(req.username()),
            validatePassword(req.password(), req.confirmPassword())
          ).ap(RegistrationRequest::new)
      )
      .toEither()
      .mapLeft(ZoneBlitzValidationError::new);
  }

  private Validation<String, String> validateUsername(String username) {
    return required(username, USERNAME_FIELD_NAME).flatMap(
      maximumLength(USERNAME_FIELD_NAME, USERNAME_MAXIMUM_LENGTH)
    );
  }

  private Validation<String, String> validatePassword(
    String password,
    String confirmPassword
  ) {
    return required(password, PASSWORD_FIELD_NAME)
      .flatMap(maximumLength(PASSWORD_FIELD_NAME, PASSWORD_MAXIMUM_LENGTH))
      .flatMap(minimumLength(PASSWORD_FIELD_NAME, PASSWORD_MINIMUM_LENGTH))
      .map(value -> new Tuple2<>(value, confirmPassword))
      .flatMap(matches(PASSWORD_FIELD_NAME, "Confirm Password"))
      .map(passwords -> passwords._1);
  }
}
