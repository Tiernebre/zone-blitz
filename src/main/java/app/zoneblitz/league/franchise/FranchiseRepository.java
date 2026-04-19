package app.zoneblitz.league.franchise;

import java.util.List;
import java.util.Optional;

public interface FranchiseRepository {

  List<Franchise> listAll();

  Optional<Franchise> findById(long id);
}
