import type { TextSelection } from './markdown-shortcuts';

export type FieldTextReplacement = Readonly<{
  field: HTMLTextAreaElement;
  next: TextSelection;
  onFallback: (value: string) => void;
}>;

type NativeTextEditing = Readonly<{
  execCommand: (...insert: [command: 'insertText', showUi: boolean, text: string]) => boolean;
}>;

export function replaceFieldText({ field, next, onFallback }: FieldTextReplacement): void {
  const editing: NativeTextEditing = document;
  field.select();
  if (!editing.execCommand('insertText', false, next.value)) {
    field.value = next.value;
    onFallback(next.value);
  }
  field.setSelectionRange(next.selectionStart, next.selectionEnd);
}
