export function frameDestination(input, parseInput) {
  const value = parseInput(input);
  if (value.kind === 'url') return value.url;
  if (value.kind === 'search') return `https://www.google.com/search?q=${encodeURIComponent(value.text)}`;
  throw new Error('请输入网址或搜索词，或选择“打开当前网页”。');
}
