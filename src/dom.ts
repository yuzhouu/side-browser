// Required template elements fail at startup with a useful selector if markup drifts.
export function element<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document
): T {
  const result = root.querySelector<T>(selector);
  if (!result) throw new Error(`Missing element: ${selector}`);
  return result;
}
