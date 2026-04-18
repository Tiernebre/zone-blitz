package app.zoneblitz.league;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
class ListFranchisesUseCase implements ListFranchises {

  private final FranchiseRepository repository;

  ListFranchisesUseCase(FranchiseRepository repository) {
    this.repository = repository;
  }

  @Override
  public List<Franchise> list() {
    return repository.listAll();
  }
}
