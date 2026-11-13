import { searchUrl } from './search-engine.js';
import type { CustomSearchEngine, SearchEngine, ParsedInput } from './types.js';
import { userError } from './errors.js';

export function frameDestination(
  input: unknown,
  parseInput: (input: unknown) => ParsedInput,
  engine: SearchEngine = 'google',
  custom: CustomSearchEngine | null = null
) {
  const value = parseInput(input);
  if (value.kind === 'url') return value.url;
  if (value.kind === 'search') return searchUrl(value.text, engine, custom);
  throw userError('errorEmptyInput');
}
