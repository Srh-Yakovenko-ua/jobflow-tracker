export const COPY_UK = {
  sending: 'Додаємо в JobFlow…',
  added: 'Додано в JobFlow · AI розбирає',
  openCard: 'Відкрити картку',
  duplicateDated: 'Ти вже відгукувався сюди',
  duplicateUndated: 'Ця вакансія вже є в JobFlow',
  stage: 'етап',
  unauthorized: 'Букмарклет вимкнено',
  newBookmarklet: 'Створити новий',
  conflict: 'Немає активного пошуку або цю сторінку сьогодні вже додано',
  openBoard: 'Відкрити дошку',
  rateLimited: 'Забагато запитів, спробуй',
  failed: 'Не вдалося додати',
  addByHand: 'Додати вручну',
  close: 'Закрити',
} as const;

export type CopyKey = keyof typeof COPY_UK;
