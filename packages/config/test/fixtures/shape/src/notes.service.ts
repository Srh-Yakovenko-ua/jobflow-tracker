class NotesRepository {}
class AuthService {}
class Clock {}

export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly authService: AuthService,
    private readonly clock: Clock,
  ) {}

  describe(title: string, body: string, author: string): string {
    return `${title}:${body}:${author}`;
  }
}
