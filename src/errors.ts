// Keep shared logic independent of Chrome and translate only at the UI boundary.
export function userError(code: string) {
  return Object.assign(new Error(code), { code });
}
