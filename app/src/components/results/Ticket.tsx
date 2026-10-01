import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useLang, useT, localeOf } from '@/i18n';
import { ephemerisOf } from '@/platform/almanac';
import { colorDef } from '@/components/setup/constants';
import type { FinalResult } from './types';
import { rankPlayers } from './types';

/* ------------------------------------------------------------------ */
/* The ticket: the game printed as a railway ticket of the era — the   */
/* company, the route (the canal era to the rail era), the passenger,  */
/* the points and the place, the date, a stamp for the winner — drawn  */
/* on a canvas with the page's own faces, and saved as a picture.      */
/* ------------------------------------------------------------------ */

const W = 1200;
const H = 460;

function draw(cv: HTMLCanvasElement, r: FinalResult, me: number, table: string, lines: Record<string, string>, locale: string): void {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const scale = 2;
  cv.width = W * scale;
  cv.height = H * scale;
  ctx.scale(scale, scale);
  /* the paper */
  ctx.fillStyle = '#efe3c4';
  ctx.fillRect(0, 0, W, H);
  const grain = ctx.createLinearGradient(0, 0, 0, H);
  grain.addColorStop(0, 'rgba(120,90,40,0.10)');
  grain.addColorStop(0.2, 'rgba(120,90,40,0)');
  grain.addColorStop(0.8, 'rgba(120,90,40,0)');
  grain.addColorStop(1, 'rgba(120,90,40,0.14)');
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, W, H);
  /* the double rule */
  ctx.strokeStyle = 'rgba(42,36,28,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  /* the stub, parted by a perforation */
  const stub = 250;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(stub, 22);
  ctx.lineTo(stub, H - 22);
  ctx.stroke();
  ctx.setLineDash([]);
  const ink = '#241d14';
  const brass = '#8a6b33';
  const rust = '#9c2f22';
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  /* the stub: the company set on its side, the number */
  ctx.save();
  ctx.translate(stub / 2 + 10, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '500 44px Fraunces, Georgia, serif';
  ctx.fillText('B L A C K R A I L', 0, 0);
  ctx.font = '14px "IBM Plex Mono", monospace';
  ctx.fillStyle = brass;
  ctx.fillText(lines.company, 0, 32);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.font = '13px "IBM Plex Mono", monospace';
  ctx.fillStyle = 'rgba(36,29,20,0.6)';
  ctx.fillText(`N° ${lines.number}`, 40, 56);
  ctx.fillText(lines.date, 40, H - 44);
  /* the main: the heading, the route, the passenger */
  const x = stub + 40;
  ctx.fillStyle = brass;
  ctx.font = '18px "IM Fell English SC", Georgia, serif';
  ctx.fillText(lines.title.toUpperCase().split('').join(String.fromCharCode(0x2009)), x, 70);
  ctx.fillStyle = ink;
  ctx.font = '500 20px Fraunces, Georgia, serif';
  ctx.fillText(lines.route, x, 108);
  ctx.strokeStyle = 'rgba(42,36,28,0.45)';
  ctx.beginPath();
  ctx.moveTo(x, 126);
  ctx.lineTo(W - 60, 126);
  ctx.stroke();
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(36,29,20,0.6)';
  ctx.fillText(lines.passenger.toUpperCase(), x, 160);
  const ranked = rankPlayers(r);
  const mine = ranked.find((p) => p.index === me) ?? ranked[0];
  const place = ranked.findIndex((p) => p.index === mine.index) + 1;
  ctx.fillStyle = ink;
  ctx.font = '400 56px Fraunces, Georgia, serif';
  ctx.fillText(mine.player.name, x, 214);
  ctx.font = '15px "IBM Plex Mono", monospace';
  ctx.fillStyle = 'rgba(36,29,20,0.75)';
  ctx.fillText(`${lines.points.replace('{vp}', String(mine.player.vp))}  ·  ${lines.place.replace('{n}', String(place)).replace('{of}', String(ranked.length))}`, x, 248);
  ctx.fillText(table, x, 274);
  /* the other passengers, a line each with their colour */
  let y = 322;
  ctx.font = '13px "IBM Plex Mono", monospace';
  for (const { player, index } of ranked) {
    ctx.fillStyle = colorDef(player.color).hex;
    ctx.beginPath();
    ctx.arc(x + 6, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = index === me ? ink : 'rgba(36,29,20,0.7)';
    ctx.fillText(`${player.name}`, x + 22, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(player.vp), x + 300, y);
    ctx.textAlign = 'left';
    y += 24;
  }
  /* the stamp of the winner */
  if (r.winnerIndex === me) {
    ctx.save();
    ctx.translate(W - 210, 300);
    ctx.rotate(-0.16);
    ctx.strokeStyle = rust;
    ctx.fillStyle = rust;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3;
    ctx.strokeRect(-110, -34, 220, 68);
    ctx.lineWidth = 1;
    ctx.strokeRect(-104, -28, 208, 56);
    ctx.textAlign = 'center';
    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillText(lines.winner.toUpperCase().split('').join(String.fromCharCode(0x2009)), 0, 10);
    ctx.restore();
  }
  /* the year of the era, large and faint, in the corner */
  ctx.fillStyle = 'rgba(138,107,51,0.35)';
  ctx.font = '400 96px Fraunces, Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(lines.year, W - 56, 112);
  ctx.textAlign = 'left';
  void locale;
}

export default function Ticket({ result, me, table }: { result: FinalResult; me: number; table: string }) {
  const t = useT();
  const lang = useLang();
  const cv = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const e = ephemerisOf();
    const lines = {
      company: t('results.ticket.company'),
      title: t('results.ticket.title'),
      route: t('results.ticket.route'),
      passenger: t('results.ticket.passenger'),
      points: t('results.ticket.points'),
      place: t('results.ticket.place'),
      winner: t('results.ticket.winner'),
      number: String(1000 + ((Date.now() / 60000) | 0) % 9000),
      date: `${new Date().toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long' })} ${e.year}`,
      year: String(e.year),
    };
    let alive = true;
    void document.fonts.ready.then(() => {
      if (!alive || !cv.current) return;
      draw(cv.current, result, me, table, lines, localeOf(lang));
      setSrc(cv.current.toDataURL('image/png'));
    });
    return () => {
      alive = false;
    };
  }, [result, me, table, t, lang]);

  const save = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `blackrail-${table.replace(/\W+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={cv} className="hidden" aria-hidden />
      {src && <img src={src} alt={t('results.ticket.alt')} className="w-full max-w-[760px] shadow-[0_10px_30px_rgba(0,0,0,.45)]" width={W} height={H} />}
      <button type="button" onClick={save} disabled={!src} className="btn-ledger">
        <Download size={14} aria-hidden />
        {t('results.ticket.download')}
      </button>
    </div>
  );
}
