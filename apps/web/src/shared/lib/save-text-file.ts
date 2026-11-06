export type TextFile = Readonly<{ text: string; fileName: string; type: string }>;

export function saveTextFile({ text, fileName, type }: TextFile): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
