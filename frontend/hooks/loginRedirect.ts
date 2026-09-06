/** Pure helper so auth redirect targets stay unit-testable. */
export function loginRedirectUrl(pathname: string, nextPath?: string) {
  const next = nextPath || pathname || '/';
  return `/login?next=${encodeURIComponent(next)}`;
}
