import { useState } from 'react';
import { COUNTER, GUINEAS } from '@/online/counter';
import type { CounterItem } from '@/online/counter';
import { deskErrorKey } from '@/online/errors';
import { buyItem, useDesk, useSession } from '@/online/session';
import { setBoardOption, useBoardOptions } from '@/components/game/boardOptions';
import type { RailPainting } from '@/components/game/boardOptions';
import type { SlotArt } from '@/gl/faces';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ */
/* Le comptoir — looks paid in guineas earned at the tables. Owning a  */
/* painting or a set of tiles is one thing, wearing it another: the    */
/* board options say what is on the table.                             */
/* ------------------------------------------------------------------ */

const PIC: Record<string, string> = {
  'sign-shrewsbury': '/merchant-house-shrewsbury.webp',
  'sign-oxford': '/merchant-house-oxford.webp',
  'sign-gloucester': '/merchant-house-gloucester.webp',
  'sign-nottingham': '/merchant-house-nottingham.webp',
  'sign-warrington': '/merchant-house-warrington.webp',
  'painting-rail-1': '/map-era-rail.webp',
  'painting-rail-2': '/map-era-rail-2.webp',
  'painting-rail-3': '/map-era-rail-3.webp',
  'portrait-1': '/portrait-1.webp',
  'portrait-2': '/portrait-2.webp',
  'portrait-3': '/portrait-3.webp',
  'portrait-4': '/portrait-4.webp',
  'tiles-engraved': '/tile-coal-cut.png',
  'tiles-mono': '/tile-coal-cut.png',
};

/** what wearing an item means on the board, when it means anything */
function wear(item: CounterItem): { key: 'railPainting'; value: RailPainting } | { key: 'slotArt'; value: SlotArt } | null {
  if (item.kind === 'painting') return { key: 'railPainting', value: item.id.slice(-1) as RailPainting };
  if (item.id === 'tiles-mono') return { key: 'slotArt', value: 'mono' };
  if (item.id === 'tiles-engraved') return { key: 'slotArt', value: 'engraved' };
  return null;
}

export default function Counter() {
  const t = useT();
  const session = useSession();
  const desk = useDesk();
  const opts = useBoardOptions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;
  const purse = desk?.purse ?? { guineas: 0, owned: [] };
  const owned = (item: CounterItem) => item.price === 0 || purse.owned.includes(item.id);
  const buy = async (item: CounterItem) => {
    setError(null);
    if (purse.guineas < item.price) {
      setError(t('hall.counter.poor', { n: item.price - purse.guineas }));
      return;
    }
    setBusy(item.id);
    try {
      await buyItem(item.id);
    } catch (e) {
      setError(t(deskErrorKey(e)));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <div className="hall-head">
        <h1>{t('hall.counter.title')}</h1>
        <div className="hall-purse">
          <span>{t('hall.counter.purse')}</span>
          <b className="num">{purse.guineas}</b>
          <span>{t('hall.counter.guineas')}</span>
        </div>
      </div>
      <p className="label" style={{ marginTop: -10, marginBottom: 18 }}>
        {t('hall.counter.hint', { sitting: GUINEAS.sitting, win: GUINEAS.win })}
      </p>
      {error && (
        <p role="alert" className="hall-alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <div className="hall-shop">
        {COUNTER.map((item) => {
          const has = owned(item);
          const w = wear(item);
          const worn = w ? opts[w.key] === w.value : false;
          return (
            <article key={item.id} className="hall-item">
              <div className={`pic${item.kind === 'tiles' ? ' tile' : ''}`} style={{ backgroundImage: `url('${PIC[item.id]}')`, filter: item.id === 'tiles-mono' ? 'grayscale(1) contrast(1.2)' : undefined }}>
                <span className={`tag${has ? (item.price === 0 ? '' : ' owned') : ' new'}`}>{has ? (item.price === 0 ? t('hall.counter.free') : t('hall.counter.owned')) : t(`hall.counter.kinds.${item.kind}`)}</span>
              </div>
              <div className="body">
                <h3>{t(`hall.counter.items.${item.id}.title`)}</h3>
                <p>{t(`hall.counter.items.${item.id}.body`)}</p>
                <div className="foot">
                  <span className="hall-price">
                    {item.price === 0 ? '—' : item.price}
                    {item.price > 0 && <small>{t('hall.counter.guineas').split(' ')[0]}</small>}
                  </span>
                  {has ? (
                    w ? (
                      <button type="button" className={`hall-btn${worn ? '' : ' go'}`} disabled={worn} onClick={() => setBoardOption(w.key, w.value as never)}>
                        {worn ? t('hall.counter.equipped') : t('hall.counter.equip')}
                      </button>
                    ) : (
                      <span className="hall-btn" aria-disabled>
                        {t('hall.counter.owned')}
                      </span>
                    )
                  ) : (
                    <button type="button" className="hall-btn go" disabled={busy === item.id || !session.verified} onClick={() => buy(item)}>
                      {t('hall.counter.buy')}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
