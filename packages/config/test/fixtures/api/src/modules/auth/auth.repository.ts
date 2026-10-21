type User = { id: string; email: string };

export class AuthRepository {
  private readonly users: User[] = [];

  findByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email === email);
  }
}
