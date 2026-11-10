export function javascriptUrlOf(code: string): string {
  const escaped = code.replace(/[%#?\s]/g, (character) => encodeURIComponent(character));
  return `javascript:${escaped}`;
}
