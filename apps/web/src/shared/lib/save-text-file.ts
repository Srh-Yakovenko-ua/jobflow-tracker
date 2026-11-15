export type TextFile = Readonly<{ text: string; fileName: string; type: string }>;

export type BlobFile = Readonly<{ blob: Blob; fileName: string }>;

export function saveBlob({ blob, fileName }: BlobFile): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function saveTextFile({ text, fileName, type }: TextFile): void {
  saveBlob({ blob: new Blob([text], { type }), fileName });
}
