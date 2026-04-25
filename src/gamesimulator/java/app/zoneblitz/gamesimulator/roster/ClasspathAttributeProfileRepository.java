package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.role.AttributeAxis;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Loads {@link AttributeProfile}s from {@code /attributes/per-position/&lt;position&gt;.json} on
 * the classpath. JSON schema:
 *
 * <pre>
 * { "position": "S",
 *   "components": [
 *     { "weight": 0.45, "name": "box-shape",
 *       "means":   { "speed": 75, "tackling": 80 },
 *       "stddevs": { "speed": 8,  "tackling": 7 },
 *       "correlations": [ ["tackling", "blockShedding", 0.55] ] }
 *   ] }
 * </pre>
 *
 * <p>Axes not specified in {@code means} or {@code stddevs} are filled with the cross-position
 * floor by the sampler — the JSON only mentions axes the position cares about. Correlations not
 * listed default to zero.
 */
public final class ClasspathAttributeProfileRepository implements AttributeProfileRepository {

  private final ObjectMapper mapper = new ObjectMapper();

  @Override
  public AttributeProfile loadFor(Position position) {
    Objects.requireNonNull(position, "position");
    var resource = "/attributes/per-position/" + position.name().toLowerCase(Locale.ROOT) + ".json";
    try (InputStream in = ClasspathAttributeProfileRepository.class.getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalArgumentException("Attribute profile not found on classpath: " + resource);
      }
      var root = mapper.readTree(in);
      return parseProfile(position, root, resource);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read attribute profile: " + resource, e);
    }
  }

  private AttributeProfile parseProfile(Position position, JsonNode root, String resource) {
    if (!root.has("components")) {
      throw new IllegalArgumentException("Missing 'components' in " + resource);
    }
    var componentsNode = root.get("components");
    if (!componentsNode.isArray() || componentsNode.isEmpty()) {
      throw new IllegalArgumentException("'components' must be a non-empty array in " + resource);
    }
    var components = new java.util.ArrayList<AttributeMixtureComponent>(componentsNode.size());
    for (var node : componentsNode) {
      components.add(parseComponent(node, resource));
    }
    return new AttributeProfile(position, components);
  }

  private AttributeMixtureComponent parseComponent(JsonNode node, String resource) {
    if (!node.has("weight")) {
      throw new IllegalArgumentException("Component missing 'weight' in " + resource);
    }
    var weight = node.get("weight").asDouble();
    var name = node.has("name") ? node.get("name").asText() : "unnamed";
    var means = parseAxisDoubles(node, "means", resource);
    var stddevs = parseAxisDoubles(node, "stddevs", resource);
    var correlations = parseCorrelations(node, resource);
    return new AttributeMixtureComponent(weight, name, means, stddevs, correlations);
  }

  private Map<AttributeAxis, Double> parseAxisDoubles(
      JsonNode parent, String field, String resource) {
    if (!parent.has(field)) {
      return Map.of();
    }
    var node = parent.get(field);
    if (!node.isObject()) {
      throw new IllegalArgumentException("'" + field + "' must be an object in " + resource);
    }
    var out = new HashMap<AttributeAxis, Double>();
    var fields = node.fields();
    while (fields.hasNext()) {
      var entry = fields.next();
      var axis = AxisRegistry.byJsonName(entry.getKey());
      out.put(axis, entry.getValue().asDouble());
    }
    return out;
  }

  private Map<AxisPair, Double> parseCorrelations(JsonNode parent, String resource) {
    if (!parent.has("correlations")) {
      return Map.of();
    }
    var node = parent.get("correlations");
    if (!node.isArray()) {
      throw new IllegalArgumentException("'correlations' must be an array in " + resource);
    }
    var out = new HashMap<AxisPair, Double>();
    for (var entry : node) {
      if (!entry.isArray() || entry.size() != 3) {
        throw new IllegalArgumentException(
            "Each correlation must be a 3-element array [axisA, axisB, rho] in " + resource);
      }
      var a = AxisRegistry.byJsonName(entry.get(0).asText());
      var b = AxisRegistry.byJsonName(entry.get(1).asText());
      if (a == b) {
        throw new IllegalArgumentException(
            "Self-correlations are implicit (1.0); remove " + a.code() + " in " + resource);
      }
      var rho = entry.get(2).asDouble();
      var pair = AxisPair.of(a, b);
      if (out.containsKey(pair)) {
        throw new IllegalArgumentException(
            "Duplicate correlation entry for " + pair + " in " + resource);
      }
      out.put(pair, rho);
    }
    return out;
  }
}
