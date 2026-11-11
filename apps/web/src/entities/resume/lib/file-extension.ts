export function fileExtensionOf(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}
