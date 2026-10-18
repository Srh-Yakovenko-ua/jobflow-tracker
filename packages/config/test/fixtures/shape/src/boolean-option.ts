export function archivedLabel({ isArchived }: { isArchived: boolean }): string {
  return isArchived ? 'archived' : 'active';
}
