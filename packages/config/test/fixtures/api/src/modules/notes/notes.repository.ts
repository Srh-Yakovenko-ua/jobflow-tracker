type Note = { id: string; userId: string };

export class NotesRepository {
  private readonly notes: Note[] = [];

  findById(userId: string, id: string): Note | undefined {
    return this.notes.find((note) => this.isOwnedBy(note, userId) && note.id === id);
  }

  findAll(): Note[] {
    return this.notes;
  }

  private isOwnedBy(note: Note, userId: string): boolean {
    return note.userId === userId;
  }
}
