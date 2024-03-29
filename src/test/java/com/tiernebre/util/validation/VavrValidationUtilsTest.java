package com.tiernebre.util.validation;

import com.tiernebre.test.TestCase;
import com.tiernebre.test.TestCaseRunner;
import io.vavr.Tuple2;
import io.vavr.collection.List;
import io.vavr.control.Validation;
import org.junit.jupiter.api.Test;

public class VavrValidationUtilsTest {

  @Test
  public void required() {
    var fieldName = "requiredField";
    Validation<String, String> expectedError = Validation.invalid(
      String.format("%s is a required field.", fieldName)
    );
    TestCaseRunner.run(
      VavrValidationUtils.class,
      List.of(
        new TestCase<String, Validation<String, String>>(
          "null",
          null,
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "empty",
          "",
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "blank",
          " ",
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "filled out",
          "a",
          input -> Validation.valid(input)
        )
      ),
      input -> VavrValidationUtils.required(fieldName).apply(input)
    );
  }

  @Test
  public void curriedRequired() {
    var fieldName = "requiredField";
    Validation<String, String> expectedError = Validation.invalid(
      String.format("%s is a required field.", fieldName)
    );
    TestCaseRunner.run(
      VavrValidationUtils.class,
      List.of(
        new TestCase<String, Validation<String, String>>(
          "null",
          null,
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "empty",
          "",
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "blank",
          " ",
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "filled out",
          "a",
          input -> Validation.valid(input)
        )
      ),
      input -> VavrValidationUtils.required(input, fieldName)
    );
  }

  @Test
  public void maximumLength() {
    var fieldName = "maximumLengthField";
    var length = 2;
    Validation<String, String> expectedError = Validation.invalid(
      String.format(
        "%s cannot be greater than %s characters long.",
        fieldName,
        length
      )
    );
    TestCaseRunner.run(
      VavrValidationUtils.class,
      List.of(
        new TestCase<String, Validation<String, String>>(
          "exceeds",
          "a".repeat(length + 1),
          __ -> expectedError
        ),
        new TestCase<String, Validation<String, String>>(
          "exact",
          "a".repeat(length),
          input -> Validation.valid(input)
        ),
        new TestCase<String, Validation<String, String>>(
          "less",
          "a".repeat(length - 1),
          input -> Validation.valid(input)
        )
      ),
      input -> VavrValidationUtils.maximumLength(fieldName, length).apply(input)
    );
  }

  @Test
  public void minimumLength() {
    var fieldName = "minimumLengthField";
    var length = 2;
    Validation<String, String> expectedError = Validation.invalid(
      String.format(
        "%s cannot be lesser than %s characters long.",
        fieldName,
        length
      )
    );
    TestCaseRunner.run(
      VavrValidationUtils.class,
      List.of(
        new TestCase<String, Validation<String, String>>(
          "exceeds",
          "a".repeat(length + 1),
          input -> Validation.valid(input)
        ),
        new TestCase<String, Validation<String, String>>(
          "exact",
          "a".repeat(length),
          input -> Validation.valid(input)
        ),
        new TestCase<String, Validation<String, String>>(
          "less",
          "a".repeat(length - 1),
          __ -> expectedError
        )
      ),
      input -> VavrValidationUtils.minimumLength(fieldName, length).apply(input)
    );
  }

  @Test
  public void matches() {
    var fieldName = "fieldA";
    var otherFieldName = "fieldB";
    TestCaseRunner.run(
      VavrValidationUtils.class,
      List.of(
        new TestCase<
          Tuple2<Object, Object>,
          Validation<String, Tuple2<Object, Object>>
        >(
          "not a match",
          new Tuple2<Object, Object>("A", "B"),
          input -> Validation.invalid("fieldA must match fieldB.")
        ),
        new TestCase<
          Tuple2<Object, Object>,
          Validation<String, Tuple2<Object, Object>>
        >(
          "match",
          new Tuple2<Object, Object>("A", "A"),
          input -> Validation.valid(input)
        )
      ),
      input ->
        VavrValidationUtils.matches(fieldName, otherFieldName).apply(input)
    );
  }
}
