package app.zoneblitz.league;

import java.util.ArrayList;
import java.util.List;

/**
 * Small utility for (de)serializing {@code List<Long>} to/from JSONB array strings without pulling
 * a JSON binding dependency into the repository layer. The shape is deliberately strict: a JSON
 * array of integer literals.
 */
final class JsonLongArrays {

  private JsonLongArrays() {}

  static String encode(List<Long> ids) {
    if (ids.isEmpty()) {
      return "[]";
    }
    var sb = new StringBuilder("[");
    for (var i = 0; i < ids.size(); i++) {
      if (i > 0) sb.append(',');
      sb.append(ids.get(i).longValue());
    }
    sb.append(']');
    return sb.toString();
  }

  static List<Long> decode(String json) {
    if (json == null) return List.of();
    var trimmed = json.trim();
    if (trimmed.isEmpty() || trimmed.equals("[]")) return List.of();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
      throw new IllegalStateException("Expected JSON array, got: " + trimmed);
    }
    var body = trimmed.substring(1, trimmed.length() - 1).trim();
    if (body.isEmpty()) return List.of();
    var parts = body.split(",");
    var out = new ArrayList<Long>(parts.length);
    for (var p : parts) {
      out.add(Long.parseLong(p.trim()));
    }
    return List.copyOf(out);
  }
}
