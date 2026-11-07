const LATIN = Array.from("qwertyuiop[]asdfghjkl;'zxcvbnm,.");

const CYRILLIC = Array.from('йцукенгшщзхїфівапролджєячсмитьбю');

const SWAPPED: ReadonlyMap<string, string> = new Map(
  LATIN.flatMap((latin, index) => {
    const cyrillic = CYRILLIC[index];
    return cyrillic === undefined ? [] : [[latin, cyrillic] as const, [cyrillic, latin] as const];
  }),
);

export function swapLayout(text: string): string {
  return Array.from(text.toLowerCase(), (char) => SWAPPED.get(char) ?? char).join('');
}
