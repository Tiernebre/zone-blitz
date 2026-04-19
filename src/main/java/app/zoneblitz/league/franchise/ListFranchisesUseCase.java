package app.zoneblitz.league.franchise;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ListFranchisesUseCase implements ListFranchises {

  private final FranchiseRepository repository;

  public ListFranchisesUseCase(FranchiseRepository repository) {
    this.repository = repository;
  }

  @Override
  public List<Franchise> list() {
    return repository.listAll();
  }
}
