const FIRST_CYRILLIC = 0x410;
const SHIFT = 0x3ee;
const SPACE = 0x20;

export function packText(text: string): string {
  return text.replace(/[А-ї !-i~]/g, (character) => {
    if (character === ' ') {
      return '!';
    }
    const code = character.charCodeAt(0);
    return code < FIRST_CYRILLIC ? `~${character}` : String.fromCharCode(code - SHIFT);
  });
}

export function unpackText(packed: string): string {
  return packed.replace(
    /~(.)|[!-i]/g,
    (character, marked?: string) =>
      marked ?? String.fromCharCode(character > '!' ? character.charCodeAt(0) + SHIFT : SPACE),
  );
}
