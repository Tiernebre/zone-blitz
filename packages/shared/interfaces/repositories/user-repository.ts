export interface UserRepository {
  deleteById(id: string): Promise<void>;
}
