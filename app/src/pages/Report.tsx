import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { positionsOf, winChance, LOSS, judgeOf } from '@/game/analysis';
import type { Reading, Verdict } from '@/game/analysis';
import { onReading, readGame, reading as readingNow } from '@/game/analysisRun';
import { analysisKey, readKept } from '@/game/analysisKeep';
import { PLAYER_COLORS } from '@/game/data';
import { describeAction, useGame } from '@/game/store';
import { readShared, shareFragment } from '@/game/share';
import type { GameState } from '@/game/types';
import { useT } from '@/i18n';
import AnalysisCurve from '@/components/game/AnalysisCurve';
import Button from '@/components/platform/Button';

/* ------------------------------------------------------------------ */
/* The report: a finished game handed on in a link, read here. The     */
/* curve, the seats ranked, the key moments, and the door to the table */
/* itself for whoever wants to walk the moves. The link carries the    */
/* whole game; the reading runs in this browser, and lands on the      */
/* shelf like any other.                                               */
/* ------------------------------------------------------------------ */

const EMPTY_SEATS: Record<number, Reading[]> = {};

export default function Report() {
  const t = useT();
  const judgeId = useGame((s) => s.judgeId);
  const [game] = useState<GameState | null>(() => readShared(window.location.hash));
  const table = game ? `report:${game.seed}` : 'report';
  const me = useMemo(() => (game ? Math.max(0, game.players.findIndex((p) => !p.isBot)) : 0), [game]);
  const [seat, setSeat] = useState<number | null>(null);
  const shown = seat ?? me;
  useEffect(() => {
    if (game && game.phase === 'game-over') readGame(game, table, shown, judgeId);
  }, [game, table, shown, judgeId]);
  const snap = useSyncExternalStore(onReading, readingNow, readingNow);
  const key = game ? analysisKey(table, game.seed, judgeId) : '';
  const kept = useMemo(() => (game ? readKept(key, game.actions.length) : null), [key, game]);
  const read = snap.key === key ? snap : kept;
  const positions = useMemo(() => (game ? positionsOf(game) : []), [game]);
  const seats = read?.seats ?? EMPTY_SEATS;
  const reads = useMemo(() => positions.map((_, k) => seats[k]?.[shown]), [positions, seats, shown]);
  const chances = useMemo(() => positions.map((p, k) => reads[k]?.chance ?? winChance(p, shown)), [positions, reads, shown]);
  const wantPasses = judgeOf(judgeId).passes.length;
  const settled = useMemo(() => reads.map((r) => !!r && r.passes >= wantPasses), [reads, wantPasses]);
  const verdicts = read?.verdicts ?? {};
  const mine: Record<number, Verdict> = verdicts[shown] ?? {};
  const rivals = useMemo(() => (game ? game.players.map((p, i) => ({ seat: i, color: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C', chances: positions.map((_, k) => seats[k]?.[i]?.chance ?? null) })).filter((r) => r.seat !== shown && r.chances.some((c) => c !== null)) : []), [game, positions, seats, shown]);
  const [at, setAt] = useState<number>(positions.length - 1);
  const drops = useMemo(() => {
    const out: { k: number; drop: number; seat: number }[] = [];
    for (let k = 1; k < chances.length; k++) {
      const drop = chances[k - 1] - chances[k];
      if (drop > LOSS.good && game) out.push({ k, drop, seat: positions[k - 1].current });
    }
    return out.sort((a, b) => b.drop - a.drop).slice(0, 5);
  }, [chances, positions, game]);
  const standings = useMemo(() => {
    if (!game) return [];
    const acted = game.players.map(() => 0);
    positions.forEach((p, k) => {
      const a = game.actions[k];
      if (!a || a.kind === 'concede' || a.kind === 'resign' || a.kind === 'begin-rail') return;
      acted[p.current] += 1;
    });
    return game.players
      .map((p, i) => {
        const list = Object.values(verdicts[i] ?? {});
        return { seat: i, name: p.name, color: p.color, vp: p.vp, n: list.length, lost: list.length ? Math.round((100 * list.reduce((s, v) => s + v.loss, 0)) / list.length) : 0, misses: list.filter((v) => v.loss > LOSS.good).length, perAction: acted[i] ? Math.round((10 * p.vp) / acted[i]) / 10 : 0 };
      })
      .sort((a, b) => b.vp - a.vp);
  }, [game, verdicts, positions]);
  const progress = snap.key === key && snap.running ? snap : null;

  if (!game) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-16 sm:px-8">
        <h1 className="display-hero">{t('platform.desk.report.title')}</h1>
        <p className="mt-3 font-ui text-[15px] text-paper-300">{t('platform.desk.report.none')}</p>
      </div>
    );
  }
  const door = `/game/local/RPRT${shareFragment(game, at)}`;
  return (
    <div className="mx-auto max-w-[960px] px-4 py-10 sm:px-8">
      <p className="eyebrow-fell">{t('platform.desk.report.eyebrow')}</p>
      <h1 className="display-hero mt-1">{t('platform.desk.report.title')}</h1>
      <p className="mt-2 font-ui text-[14px] text-paper-300">{t('platform.desk.report.lede', { n: game.actions.length, players: game.players.length })}</p>

      <div className="mt-6 console p-4">
        <div className="flex flex-wrap items-center gap-3">
          {game.players.map((p, i) => (
            <button key={i} type="button" onClick={() => setSeat(i)} className={`flex items-center gap-2 rounded-md border px-2.5 py-1 font-ui text-[13px] ${shown === i ? 'border-brass-500 bg-brass-500/10 text-brass-300' : 'border-brass-hairline text-paper-300 hover:border-brass-500'}`}>
              <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[p.color]?.hex ?? '#C9A45C' }} />
              {p.name} <span className="data-text text-[10.5px] opacity-70">{p.vp} PV</span>
            </button>
          ))}
          {progress && <span className="data-text ml-auto text-[10.5px] text-iron-400">{t('game.debrief.reading', { done: progress.done, total: progress.total })}</span>}
        </div>
        <div className="mt-3 rounded-md bg-coal-950 p-2">
          <AnalysisCurve chances={chances} reads={reads} settled={settled} rivals={rivals} at={at} marks={mine} vary={null} color={PLAYER_COLORS[game.players[shown]?.color]?.hex ?? '#E7C978'} rounds={positions.map((p) => p.round)} titleOf={(k) => describeAction(game.actions[k - 1])} hint={t('game.debrief.curveHint')} split={positions.findIndex((p) => p.era === 'rail')} label={t('game.debrief.curve')} eras={[t('game.topbar.eraCanal'), t('game.topbar.eraRail')]} height={160} onPick={setAt} />
        </div>
        <p className="mt-2 data-text text-[10.5px] text-iron-400">{at === 0 ? t('game.debrief.start') : `${at}/${positions.length - 1} · ${describeAction(game.actions[at - 1])}`}</p>
      </div>

      <div className="mt-6 grid gap-6 min-[760px]:grid-cols-2">
        <section className="console p-4">
          <h2 className="font-ui text-[13px] font-semibold text-paper-100">{t('game.debrief.standings.title')}</h2>
          <table className="mt-2 w-full font-ui text-[13px] text-paper-300">
            <thead>
              <tr className="data-text text-[10.5px] uppercase tracking-label text-iron-400">
                <th className="py-1 text-left font-normal">{t('game.debrief.standings.seat')}</th>
                <th className="py-1 text-right font-normal">{t('game.debrief.standings.vp')}</th>
                <th className="py-1 text-right font-normal" title={t('game.debrief.standings.perActionTip')}>{t('game.debrief.standings.perAction')}</th>
                <th className="py-1 text-right font-normal">{t('game.debrief.standings.lost')}</th>
                <th className="py-1 text-right font-normal">{t('game.debrief.standings.misses')}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.seat} className={r.seat === shown ? 'text-brass-300' : ''}>
                  <td className="py-1"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[r.color]?.hex ?? '#C9A45C' }} />{r.name}</span></td>
                  <td className="py-1 text-right data-text">{r.vp}</td>
                  <td className="py-1 text-right data-text">{r.perAction.toFixed(1)}</td>
                  <td className="py-1 text-right data-text">{r.n ? `−${r.lost}` : '…'}</td>
                  <td className="py-1 text-right data-text">{r.n ? r.misses : '…'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="console p-4">
          <h2 className="font-ui text-[13px] font-semibold text-paper-100">{t('game.debrief.keyMoments')}</h2>
          <ul className="mt-2 flex flex-col gap-1 font-ui text-[13px] text-paper-300">
            {drops.map((d) => (
              <li key={d.k}>
                <button type="button" onClick={() => setAt(d.k)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-enamel-700/60">
                  <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ backgroundColor: PLAYER_COLORS[game.players[d.seat]?.color]?.hex ?? '#C9A45C' }} />
                  <span className="data-text text-[10.5px] text-iron-400">{t('game.debrief.roundShort', { round: positions[d.k - 1].round })}</span>
                  <span className="min-w-0 flex-1 truncate">{game.players[d.seat]?.name} · {describeAction(game.actions[d.k - 1])}</span>
                  <span className="data-text text-[10.5px] text-rust-400">−{Math.round(d.drop * 100)} %</span>
                </button>
              </li>
            ))}
            {!drops.length && <li className="text-iron-400">{t('platform.desk.report.noDrops')}</li>}
          </ul>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" to={door}>{t('platform.desk.report.open')}</Button>
        <Link to="/" className="font-ui text-[13px] text-iron-400 hover:text-paper-100">{t('platform.desk.report.home')}</Link>
      </div>
    </div>
  );
}
