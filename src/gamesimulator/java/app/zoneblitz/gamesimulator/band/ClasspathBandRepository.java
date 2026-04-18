package app.zoneblitz.gamesimulator.band;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

public final class ClasspathBandRepository implements BandRepository {

  private final ObjectMapper mapper = new ObjectMapper();

  @Override
  @SuppressWarnings("unchecked")
  public <T> RateBand<T> loadRate(String path, String fieldPath, Class<T> outcomeType) {
    var node = resolve(path, fieldPath);
    if (!node.isObject()) {
      throw new IllegalArgumentException(
          "Expected object at " + fieldPath + " in " + path + " but was " + node.getNodeType());
    }
    var base = new LinkedHashMap<T, Double>();
    var coefficients = new HashMap<T, Double>();
    var fields = node.fields();
    while (fields.hasNext()) {
      var entry = fields.next();
      var key = parseKey(entry.getKey(), outcomeType);
      var child = entry.getValue();
      if (!child.has("rate")) {
        throw new IllegalArgumentException(
            "Expected 'rate' field on " + entry.getKey() + " in " + fieldPath);
      }
      base.put(key, child.get("rate").asDouble());
      coefficients.put(key, child.has("beta") ? child.get("beta").asDouble() : 0.0);
    }
    return new RateBand<>((Map<T, Double>) base, (Map<T, Double>) coefficients);
  }

  @Override
  public DistributionalBand loadDistribution(String path, String fieldPath) {
    var node = resolve(path, fieldPath);
    var required = new String[] {"min", "max", "p10", "p25", "p50", "p75", "p90"};
    for (var field : required) {
      if (!node.has(field)) {
        throw new IllegalArgumentException(
            "Missing required field '" + field + "' at " + fieldPath + " in " + path);
      }
    }
    var ladder = new TreeMap<Double, Double>();
    ladder.put(0.10, node.get("p10").asDouble());
    ladder.put(0.25, node.get("p25").asDouble());
    ladder.put(0.50, node.get("p50").asDouble());
    ladder.put(0.75, node.get("p75").asDouble());
    ladder.put(0.90, node.get("p90").asDouble());
    if (node.has("p95")) {
      ladder.put(0.95, node.get("p95").asDouble());
    }
    if (node.has("p99")) {
      ladder.put(0.99, node.get("p99").asDouble());
    }
    return new DistributionalBand(node.get("min").asInt(), node.get("max").asInt(), ladder, 0.0);
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> Map<T, Double> loadWeights(String path, String fieldPath, Class<T> keyType) {
    var node = resolve(path, fieldPath);
    if (!node.isObject()) {
      throw new IllegalArgumentException(
          "Expected object at " + fieldPath + " in " + path + " but was " + node.getNodeType());
    }
    var out = new LinkedHashMap<T, Double>();
    var fields = node.fields();
    while (fields.hasNext()) {
      var entry = fields.next();
      var value = entry.getValue();
      if (!value.isNumber()) {
        throw new IllegalArgumentException(
            "Expected numeric value for '" + entry.getKey() + "' in " + fieldPath);
      }
      out.put(parseKey(entry.getKey(), keyType), value.asDouble());
    }
    return (Map<T, Double>) out;
  }

  private JsonNode resolve(String path, String fieldPath) {
    var resource = "/bands/" + path;
    try (InputStream in = ClasspathBandRepository.class.getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalArgumentException("Band resource not found on classpath: " + resource);
      }
      JsonNode root = mapper.readTree(in);
      JsonNode cursor = root;
      for (var segment : fieldPath.split("\\.")) {
        if (cursor == null || cursor.isMissingNode() || !cursor.has(segment)) {
          throw new IllegalArgumentException(
              "Missing field '" + segment + "' while resolving '" + fieldPath + "' in " + path);
        }
        cursor = cursor.get(segment);
      }
      return cursor;
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read band resource: " + resource, e);
    }
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private static <T> T parseKey(String key, Class<T> outcomeType) {
    if (outcomeType == String.class) {
      return (T) key;
    }
    if (outcomeType == Integer.class) {
      return (T) Integer.valueOf(Integer.parseInt(key));
    }
    if (outcomeType.isEnum()) {
      return (T) Enum.valueOf((Class<Enum>) outcomeType, key.toUpperCase(java.util.Locale.ROOT));
    }
    throw new IllegalArgumentException(
        "Unsupported outcome type: " + outcomeType + "; must be String, Integer, or Enum");
  }
}
