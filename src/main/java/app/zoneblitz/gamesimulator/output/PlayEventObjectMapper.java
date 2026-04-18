package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;

/**
 * Builds the {@link ObjectMapper} used to serialize {@link PlayEvent} payloads as JSONB.
 *
 * <p>The sealed {@code PlayEvent} interface lives in the framework-free {@code gamesimulator}
 * source set and carries no Jackson annotations. Polymorphic (de)serialization is wired here via a
 * mix-in so Jackson can tag each row's payload with its variant name.
 */
final class PlayEventObjectMapper {

  private PlayEventObjectMapper() {}

  static ObjectMapper create() {
    var mapper = new ObjectMapper();
    mapper.registerModule(new Jdk8Module());
    mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    mapper.addMixIn(PlayEvent.class, PlayEventMixIn.class);
    return mapper;
  }

  @JsonTypeInfo(
      use = JsonTypeInfo.Id.NAME,
      include = JsonTypeInfo.As.PROPERTY,
      property = "@variant")
  @JsonSubTypes({
    @JsonSubTypes.Type(value = PlayEvent.PassComplete.class, name = "PassComplete"),
    @JsonSubTypes.Type(value = PlayEvent.PassIncomplete.class, name = "PassIncomplete"),
    @JsonSubTypes.Type(value = PlayEvent.Sack.class, name = "Sack"),
    @JsonSubTypes.Type(value = PlayEvent.Scramble.class, name = "Scramble"),
    @JsonSubTypes.Type(value = PlayEvent.Interception.class, name = "Interception"),
    @JsonSubTypes.Type(value = PlayEvent.Run.class, name = "Run"),
    @JsonSubTypes.Type(value = PlayEvent.FieldGoalAttempt.class, name = "FieldGoalAttempt"),
    @JsonSubTypes.Type(value = PlayEvent.ExtraPoint.class, name = "ExtraPoint"),
    @JsonSubTypes.Type(value = PlayEvent.TwoPointAttempt.class, name = "TwoPointAttempt"),
    @JsonSubTypes.Type(value = PlayEvent.Punt.class, name = "Punt"),
    @JsonSubTypes.Type(value = PlayEvent.Kickoff.class, name = "Kickoff"),
    @JsonSubTypes.Type(value = PlayEvent.Penalty.class, name = "Penalty"),
    @JsonSubTypes.Type(value = PlayEvent.Kneel.class, name = "Kneel"),
    @JsonSubTypes.Type(value = PlayEvent.Spike.class, name = "Spike"),
    @JsonSubTypes.Type(value = PlayEvent.Timeout.class, name = "Timeout"),
    @JsonSubTypes.Type(value = PlayEvent.TwoMinuteWarning.class, name = "TwoMinuteWarning"),
    @JsonSubTypes.Type(value = PlayEvent.EndOfQuarter.class, name = "EndOfQuarter"),
  })
  private abstract static class PlayEventMixIn {}
}
