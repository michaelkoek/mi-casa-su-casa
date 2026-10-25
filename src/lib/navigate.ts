/** Full-page navigation (not client routing): used after login/logout so no stale client state survives. */
export function hardNavigate(url: string) {
  window.location.assign(url);
}
