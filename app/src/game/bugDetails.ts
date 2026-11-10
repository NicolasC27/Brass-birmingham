import { tr } from '@/i18n';
import { ledgerText } from './ledgerText';
import { useGame } from './store';

/* ------------------------------------------------------------------ */
/* What a bug report says of the table it was written at: the game as  */
/* it stands and its last moves, the seat, the build and the screen —   */
/* enough to open the same position again. No names of other players'   */
/* accounts, only what the table already shows.                         */
/* ------------------------------------------------------------------ */

const VERSION = String(import.meta.env.VITE_VERSION ?? import.meta.env.MODE ?? 'dev');

/** the game on screen, in a few lines — null away from a table */
export function gameDetails(): string | null {
  const st = useGame.getState();
  const g = st.game;
  if (!g) return null;
  const lines: string[] = [];
  lines.push(`table: ${st.code ?? (st.local ? `local ${st.local}` : 'none')} · seat: ${st.seat ?? 'none'} · seed: ${g.seed}`);
  lines.push(`phase: ${g.phase} · era: ${g.era} · round: ${g.round} · current: ${g.current} (${g.players[g.current]?.name ?? '?'}) · actions left: ${g.actionsLeft} · verb: ${st.verb ?? 'none'}`);
  lines.push(`players: ${g.players.map((p, i) => `${i}:${p.name}${p.isBot ? ` [${p.persona}]` : ''} £${p.money} inc${p.income} vp${p.vp}`).join(' | ')}`);
  lines.push(`actions played: ${g.actions.length} · ledger: ${g.ledgerSeq}`);
  const last = g.ledger.slice(-8).map((e) => `  [${e.era === 'canal' ? 'Canal' : 'Rail'} R${e.round}] ${ledgerText(e, tr)}`);
  if (last.length) lines.push('last moves:', ...last);
  lines.push(`build: ${VERSION} · screen: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio} · ${navigator.userAgent}`);
  return lines.join('\n');
}
