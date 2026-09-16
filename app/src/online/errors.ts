/* the codes the desk has words for; anything else is a plain refusal */
const KNOWN = new Set(['bad-name', 'bad-email', 'weak-password', 'name-taken', 'email-taken', 'bad-credentials', 'wrong-password', 'no-session', 'sign-in-first', 'bad-token', 'unknown-email', 'offline', 'refused', 'not-found', 'full', 'started', 'verify-first', 'no-such-player', 'already-seated', 'already-invited', 'not-yours', 'already-friends', 'yourself']);

/** the i18n key that says what went wrong, for an error the office sent back */
export function deskErrorKey(e: unknown): string {
  const code = e instanceof Error ? e.message : String(e);
  return `site.desk.error.${KNOWN.has(code) ? code : 'refused'}`;
}
