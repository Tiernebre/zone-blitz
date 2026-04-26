package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.role.AttributeAxis;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import app.zoneblitz.gamesimulator.role.TendencyAxis;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Registry mapping JSON-friendly axis names ("speed", "passSet", "footballIq") to typed {@link
 * AttributeAxis} constants. Translation is the camelCase form of the enum constant name — {@code
 * PASS_SET} ↔ {@code passSet}.
 *
 * <p>Also exposes the canonical 46-axis ordering used by the Cholesky sampler: physical (8) first,
 * then skill (29), then tendency (9).
 */
final class AxisRegistry {

  static final int AXIS_COUNT = 46;

  static final List<AttributeAxis> AXES_IN_ORDER = buildAxisList();

  private static final Map<String, AttributeAxis> BY_JSON_NAME = buildByJsonName();
  private static final Map<AttributeAxis, Integer> INDEX_BY_AXIS = buildIndexByAxis();

  private AxisRegistry() {}

  static AttributeAxis byJsonName(String jsonName) {
    var axis = BY_JSON_NAME.get(jsonName);
    if (axis == null) {
      throw new IllegalArgumentException("Unknown attribute axis: " + jsonName);
    }
    return axis;
  }

  static int indexOf(AttributeAxis axis) {
    var index = INDEX_BY_AXIS.get(axis);
    if (index == null) {
      throw new IllegalStateException("Axis missing from registry: " + axis.code());
    }
    return index;
  }

  static String jsonNameFor(AttributeAxis axis) {
    return toCamelCase(((Enum<?>) axis).name());
  }

  private static List<AttributeAxis> buildAxisList() {
    var list = new java.util.ArrayList<AttributeAxis>(AXIS_COUNT);
    for (var a : PhysicalAxis.values()) {
      list.add(a);
    }
    for (var a : SkillAxis.values()) {
      list.add(a);
    }
    for (var a : TendencyAxis.values()) {
      list.add(a);
    }
    return List.copyOf(list);
  }

  private static Map<String, AttributeAxis> buildByJsonName() {
    var map = new HashMap<String, AttributeAxis>();
    for (var axis : AXES_IN_ORDER) {
      var jsonName = toCamelCase(((Enum<?>) axis).name());
      if (map.containsKey(jsonName)) {
        throw new IllegalStateException("Duplicate JSON axis name: " + jsonName);
      }
      map.put(jsonName, axis);
    }
    return Map.copyOf(map);
  }

  private static Map<AttributeAxis, Integer> buildIndexByAxis() {
    var map = new HashMap<AttributeAxis, Integer>();
    for (var i = 0; i < AXES_IN_ORDER.size(); i++) {
      map.put(AXES_IN_ORDER.get(i), i);
    }
    return Map.copyOf(map);
  }

  private static String toCamelCase(String enumName) {
    var parts = enumName.split("_");
    var sb = new StringBuilder(parts[0].toLowerCase(Locale.ROOT));
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i].toLowerCase(Locale.ROOT);
      sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
    }
    return sb.toString();
  }
}
