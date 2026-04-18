package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

interface FranchiseRepository {

  List<Franchise> listAll();

  Optional<Franchise> findById(long id);
}
