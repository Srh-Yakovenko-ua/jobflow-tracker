import source from '../../tokens/tokens.json';
import { type ColorToken, parseTokens, type Tokens } from '../tokens/schema.js';

export const tokens = parseTokens(source);

export function withColor(name: string, value: ColorToken): Tokens {
  return parseTokens({ ...tokens, color: { ...tokens.color, [name]: value } });
}
