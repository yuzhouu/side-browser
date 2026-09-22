import { searchUrl } from './search-engine.js';
import type { SearchEngine, ParsedInput } from './types.js';
import { userError } from './errors.js';

export function frameDestination(
  input: unknown,
  parseInput: (input: unknown) => ParsedInput,
  engine: SearchEngine = 'google'
) {
  const value = parseInput(input);
  if (value.kind === 'url') return value.url;
  if (value.kind === 'search') return searchUrl(value.text, engine);
  throw userError('errorEmptyInput');
}
