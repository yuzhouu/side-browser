import type { ParsedInput } from './types.js';
import { userError } from './errors.js';

export function frameDestination(input: unknown, parseInput: (input: unknown) => ParsedInput) {
  const value = parseInput(input);
  if (value.kind === 'url') return value.url;
  if (value.kind === 'search')
    return `https://www.google.com/search?q=${encodeURIComponent(value.text)}`;
  throw userError('errorEmptyInput');
}
