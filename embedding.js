import { userError } from './errors.js';

export function frameDestination(input, parseInput) {
  const value = parseInput(input);
  if (value.kind === 'url') return value.url;
  if (value.kind === 'search')
    return `https://www.google.com/search?q=${encodeURIComponent(value.text)}`;
  throw userError('errorEmptyInput');
}
