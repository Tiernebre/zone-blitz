export interface UserService {
  deleteById(id: string): Promise<void>;
}
