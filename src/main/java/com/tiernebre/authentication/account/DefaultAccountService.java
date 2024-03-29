package com.tiernebre.authentication.account;

import com.tiernebre.authentication.registration.Registration;
import com.tiernebre.util.error.ZoneBlitzError;
import com.tiernebre.util.error.ZoneBlitzServerError;
import io.vavr.control.Either;
import io.vavr.control.Option;

public final class DefaultAccountService implements AccountService {

  private final AccountRepository repository;

  public DefaultAccountService(AccountRepository accountRepository) {
    this.repository = accountRepository;
  }

  @Override
  public Either<ZoneBlitzError, Account> getForGoogleAccount(
    String googleAccountId
  ) {
    return Option.of(googleAccountId)
      .<ZoneBlitzError>toEither(
        new ZoneBlitzServerError("Given Google account id is null.")
      )
      .map(this::selectOrCreateByGoogleAccountId);
  }

  @Override
  public Option<Account> getForRegistration(long registrationId) {
    return repository.selectOneByRegistrationId(registrationId);
  }

  @Override
  public Account create(Registration registration) {
    return repository.insertOne(null, registration.id());
  }

  private Account selectOrCreateByGoogleAccountId(String accountId) {
    return repository
      .selectOneByGoogleAccountId(accountId)
      .getOrElse(() -> repository.insertOne(accountId, null));
  }
}
