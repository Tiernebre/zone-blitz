package app.zoneblitz.league;

import java.util.List;

public interface ListFranchises {

  /** Return every franchise in the catalog, ordered by city then name. */
  List<Franchise> list();
}
