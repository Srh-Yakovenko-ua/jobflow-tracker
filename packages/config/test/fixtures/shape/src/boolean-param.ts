export function archivedLabel(isArchived: boolean): string {
  return isArchived ? 'archived' : 'active';
}

export function pinnedLabel(isPinned = false): string {
  return isPinned ? 'pinned' : 'loose';
}

export function hiddenLabel(isHidden: boolean | undefined): string {
  return isHidden === true ? 'hidden' : 'shown';
}
