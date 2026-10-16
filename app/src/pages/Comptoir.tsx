import { useState } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Check, Clock, Coins } from 'lucide-react';
import Button from '@/components/platform/Button';
import MemberAvatar from '@/components/platform/MemberAvatar';
import Modal from '@/components/platform/Modal';
import Tabs, { TabPanel } from '@/components/platform/Tabs';
import PageShell from '@/components/site/PageShell';
import Toast, { type ToastData } from '@/components/platform/Toast';
import { setBoardOption, useBoardOptions, type BoardOptions } from '@/components/game/boardOptions';
import type { SlotArt } from '@/gl/faces';
import { CATALOG, COUNTER_OPEN, SHOWN_CATEGORIES, type Category, type Rarity, type ShopItem } from '@/platform/catalog';
import { equip, useWallet, type Wallet } from '@/platform/wallet';
import { GUINEAS } from '@/online/counter';
import { deskErrorKey } from '@/online/errors';
import { loadIdentity } from '@/online/identity';
import { buyItem, useSession } from '@/online/session';
import { useT, tr } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* /comptoir — la boutique du club. Les guinées se gagnent aux tables  */
/* et le bureau tient la bourse (desk.purse) : ici on lit, on demande  */
/* un achat, et on garde pour soi ce qu'on porte. Cosmétique           */
/* uniquement : zéro impact sur le jeu.                                */
/*                                                                     */
/* Le comptoir est en veille (catalog.COUNTER_OPEN) : seuls les rayons */
/* dont les images sont prêtes restent en vitrine, et rien ne s'achète */
/* — un objet qu'on ne possède pas s'annonce « bientôt ».              */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

/* the rarity is told by the rule it is set between, the way a printer
   marks a grade: none for the common, a hairline for the rare, the double
   rule for prestige. Two ochres side by side parted by a hair by day. */
const RARITY_STYLE: Record<Rarity, string> = {
  common: 'text-iron-400',
  rare: 'border-y border-[var(--gz-ink-soft)] px-2 text-paper-100',
  prestige: 'border-y-[3px] border-double border-[var(--gz-ink)] px-2 text-paper-100',
};

/** les objets en image, comme au comptoir du hall */
const PIC: Record<string, string> = {
  'sign-shrewsbury': '/merchant-house-shrewsbury.webp',
  'sign-oxford': '/merchant-house-oxford.webp',
  'sign-gloucester': '/merchant-house-gloucester.webp',
  'sign-nottingham': '/merchant-house-nottingham.webp',
  'sign-warrington': '/merchant-house-warrington.webp',
  'portrait-1': '/portrait-1.webp',
  'portrait-2': '/portrait-2.webp',
  'portrait-3': '/portrait-3.webp',
  'portrait-4': '/portrait-4.webp',
  'tiles-engraved': '/tile-coal-cut.png',
  'tiles-mono': '/tile-coal-cut.png',
};

/** les catégories dont le choix équipé est une préférence locale (carte de membre) */
const LOCAL_WEAR: ReadonlySet<Category> = new Set<Category>(['avatar', 'frame', 'title']);
/** celles qui s'affichent avec une description sous le nom */
const WITH_BLURB: ReadonlySet<Category> = new Set<Category>(['sign', 'portrait', 'tiles']);

type BoardWear = { key: 'slotArt'; value: SlotArt };

/** ce que porter un objet change sur le plateau, quand ça change quelque chose */
function boardWear(item: ShopItem): BoardWear | null {
  if (item.id === 'tiles-mono') return { key: 'slotArt', value: 'mono' };
  if (item.id === 'tiles-engraved') return { key: 'slotArt', value: 'engraved' };
  return null;
}

function isEquipped(item: ShopItem, wallet: Wallet, opts: BoardOptions): boolean {
  const w = boardWear(item);
  if (w) return opts[w.key] === w.value;
  if (LOCAL_WEAR.has(item.category)) return wallet.equipped[item.category] === item.id;
  return false;
}

function itemName(id: string): string {
  return tr(`platform.comptoir.items.${id}`);
}

/* ------------------------------ The purse ------------------------------ */

/* The purse sits at the right of the page's header, in the slot PageShell
   keeps for it — for a member only: the visitor has no purse, the office
   keeps it, and a « 0 » under his eyes would say otherwise. The rate of the tables is not repeated under it: the box
   « Ce que paient les tables » below says it once, in full. */
function Purse({ wallet }: { wallet: Wallet }) {
  const t = useT();
  const reduced = useReducedMotion();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }} className="flex flex-col items-end gap-1.5">
      <p className="micro-label text-iron-400">{t('platform.comptoir.preview.balance')}</p>
      <div className="flex items-center gap-2.5" aria-label={t('platform.comptoir.tokens', { count: wallet.balance })}>
        <Coins size={26} aria-hidden className="text-brass-300" />
        <motion.span
          key={wallet.balance}
          initial={reduced ? false : { scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease }}
          className="tnums font-fraunces text-[40px] font-semibold leading-none text-paper-100"
        >
          {wallet.balance}
        </motion.span>
      </div>
    </motion.div>
  );
}

/* --------------------------- Carte d'objet --------------------------- */

function ItemVisual({ item, equippedAvatar }: { item: ShopItem; equippedAvatar: string }) {
  if (item.category === 'avatar') {
    return <MemberAvatar avatar={item.id} size={96} />;
  }
  if (item.category === 'frame') {
    return <MemberAvatar avatar={equippedAvatar} frame={item.id} size={96} />;
  }
  if (item.category === 'title') {
    /* titre honorifique : plaque gravée */
    return (
      <span className="flex h-24 w-full items-center justify-center">
        <span className="border border-brass-hairline-strong bg-enamel-800 px-4 py-2 text-center">
          <span className="micro-label text-brass-300">{itemName(item.id)}</span>
        </span>
      </span>
    );
  }
  /* enseigne, portrait, tuiles : l'image du hall */
  const tiles = item.category === 'tiles';
  return (
    <span className={cn('block w-full overflow-hidden border border-brass-hairline bg-enamel-900', tiles ? 'flex h-32 items-center justify-center' : 'aspect-[4/3]')}>
      <img
        src={PIC[item.id]}
        alt=""
        loading="lazy"
        className={cn(tiles ? 'h-24 w-24 object-contain' : 'h-full w-full object-cover')}
        style={item.id === 'tiles-mono' ? { filter: 'grayscale(1) contrast(1.2)' } : undefined}
      />
    </span>
  );
}

/* a state is printed, not pressed: a small cartouche in the label's
   capitals, lower than a ticket so it never reads as a command */
const CARTOUCHE = 'micro-label inline-flex items-center gap-1.5 border border-[var(--gz-ink-faint)] px-2.5 py-1 text-paper-100';

function ShopItemCard({
  item,
  index,
  wallet,
  opts,
  canBuy,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  index: number;
  wallet: Wallet;
  opts: BoardOptions;
  canBuy: boolean;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
}) {
  const t = useT();
  const owned = item.price === 0 || wallet.owned.includes(item.id);
  const wearable = boardWear(item) !== null || LOCAL_WEAR.has(item.category);
  const equipped = wearable && isEquipped(item, wallet, opts);
  const affordable = wallet.balance >= item.price;
  const short = !owned && !affordable;
  const name = t(`platform.comptoir.items.${item.id}`);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease, delay: index * 0.04 }}
      className="flex flex-col items-center gap-3 console p-4 transition-colors duration-150 ease-out hover:border-brass-hairline-strong hover:bg-enamel-800"
    >
      <ItemVisual item={item} equippedAvatar={wallet.equipped.avatar} />

      <div className="text-center">
        <h3 className="title-card">{name}</h3>
        <p className={cn('micro-label mt-1.5 inline-block', RARITY_STYLE[item.rarity])}>{t(`platform.comptoir.rarity.${item.rarity}`)}</p>
        {WITH_BLURB.has(item.category) && <p className="mt-2 font-ui text-[12.5px] leading-relaxed text-paper-300">{t(`platform.comptoir.blurbs.${item.id}`)}</p>}
      </div>

      {COUNTER_OPEN && (
        <p className={cn('data-text flex items-center gap-1.5', short ? 'text-rust-400' : 'text-paper-100')}>
          <Coins size={14} aria-hidden className={short ? 'text-rust-400' : 'text-brass-300'} />
          {item.price === 0 ? t('platform.comptoir.free') : item.price}
        </p>
      )}

      <div className="mt-auto flex justify-center">
        {equipped ? (
          <span className={CARTOUCHE} aria-current="true">
            <Check size={13} aria-hidden className="text-brass-300" />
            {t('platform.comptoir.equipped')}
          </span>
        ) : owned ? (
          wearable ? (
            <Button variant="ticket" className="gz-ticket-sm" onClick={() => onEquip(item)}>
              {t('platform.comptoir.equip')}
            </Button>
          ) : (
            <span className={CARTOUCHE}>
              <BadgeCheck size={13} aria-hidden className="text-brass-300" />
              {t('platform.comptoir.owned')}
            </span>
          )
        ) : COUNTER_OPEN ? (
          <Button
            variant="ticket-brass"
            className="gz-ticket-sm"
            disabled={!canBuy || !affordable}
            title={!canBuy ? t('platform.comptoir.signedOutNote') : !affordable ? t('platform.comptoir.insufficient') : undefined}
            onClick={() => onBuy(item)}
          >
            {t('platform.comptoir.buy')}
          </Button>
        ) : (
          <span className={cn(CARTOUCHE, 'text-iron-400')}>
            <Clock size={13} aria-hidden className="text-brass-300" />
            {t('platform.comptoir.soon')}
          </span>
        )}
      </div>
    </motion.article>
  );
}

/* --------------------------- Aperçu membre --------------------------- */

function MemberPreview({ wallet }: { wallet: Wallet }) {
  const t = useT();
  const session = useSession();
  const name = session?.name || loadIdentity().name || t('platform.comptoir.preview.guest');
  const title = wallet.equipped.title;
  const ownedCount = CATALOG.filter((i) => i.price === 0 || wallet.owned.includes(i.id)).length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease, delay: 0.08 }}
      className="relative overflow-hidden console p-6 min-[900px]:sticky min-[900px]:top-24"
      aria-label={t('platform.comptoir.preview.title')}
    >
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <p className="micro-label self-start text-brass-300">{t('platform.comptoir.preview.title')}</p>
        <MemberAvatar avatar={wallet.equipped.avatar} frame={wallet.equipped.frame} size={112} />
        <div>
          <p className="truncate font-fraunces text-[22px] font-semibold leading-tight text-paper-100">{name}</p>
          {title !== 'title-none' && (
            <p className="micro-label mt-1.5 flex items-center justify-center gap-1.5 text-brass-300">
              <BadgeCheck size={12} aria-hidden />
              {t(`platform.comptoir.items.${title}`)}
            </p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-3 border-t border-[rgb(var(--paper-100)/.07)] pt-4">
          <div>
            <p className="tnums font-fraunces text-[24px] font-semibold leading-none text-paper-100">{wallet.balance}</p>
            <p className="micro-label mt-1.5 text-iron-400">{t('platform.comptoir.preview.balance')}</p>
          </div>
          <div>
            <p className="tnums font-fraunces text-[24px] font-semibold leading-none text-paper-100">
              {ownedCount}
              <span className="text-[14px] text-iron-400"> / {CATALOG.length}</span>
            </p>
            <p className="micro-label mt-1.5 text-iron-400">{t('platform.comptoir.preview.owned')}</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

/* ------------------------- Ce que paient les tables ------------------------- */

function Earnings() {
  const t = useT();
  const rows: { label: string; value: string }[] = [
    { label: t('platform.comptoir.earn.sitting'), value: `+${GUINEAS.sitting}` },
    { label: t('platform.comptoir.earn.win'), value: `+${GUINEAS.win}` },
    { label: t('platform.comptoir.earn.ranked'), value: `×${GUINEAS.rankedTimes}` },
  ];

  return (
    <section aria-label={t('platform.comptoir.earn.title')} className="relative overflow-hidden console p-5">
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <h2 className="title-card">{t('platform.comptoir.earn.title')}</h2>
        <div className="mb-3 mt-3 h-px bg-brass-hairline" />
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline gap-3">
              <span className="data-text w-14 shrink-0 text-right font-medium text-bottle-ink">{r.value}</span>
              <span className="min-w-0 flex-1 font-ui text-[13px] text-paper-300">{r.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-ui text-[12.5px] text-iron-400">{t('platform.comptoir.earn.note')}</p>
      </div>
    </section>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export default function Comptoir() {
  const t = useT();
  const wallet = useWallet();
  const session = useSession();
  const opts = useBoardOptions();
  const [tab, setTab] = useState<Category>(SHOWN_CATEGORIES[0]);
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (message: string, kind: ToastData['kind'] = 'success') => setToast({ id: Date.now(), message, kind });

  const confirmBuy = async () => {
    if (!buying || busy) return;
    const item = buying;
    const name = itemName(item.id);
    if (wallet.balance < item.price) {
      showToast(t('platform.comptoir.insufficient'), 'error');
      setBuying(null);
      return;
    }
    setBusy(true);
    try {
      await buyItem(item.id);
      showToast(tr('platform.comptoir.toastBought', { name }));
    } catch (e) {
      /* le bureau a refusé : bourse trop courte, objet déjà acquis, adresse à vérifier… */
      showToast(t(deskErrorKey(e)), 'error');
    } finally {
      setBusy(false);
      setBuying(null);
    }
  };

  const doEquip = (item: ShopItem) => {
    const w = boardWear(item);
    if (w) {
      /* les tuiles : c'est le plateau qui les porte */
      setBoardOption(w.key, w.value);
      showToast(tr('platform.comptoir.toastEquipped', { name: itemName(item.id) }), 'info');
      return;
    }
    if (equip(item.id)) showToast(tr('platform.comptoir.toastEquipped', { name: itemName(item.id) }), 'info');
  };

  const items = CATALOG.filter((i) => i.category === tab);

  return (
    <PageShell eyebrow={t('platform.comptoir.eyebrow')} title={t('platform.comptoir.title')} lede={t('platform.comptoir.lede')} aside={session ? <Purse wallet={wallet} /> : undefined}>
      {session === null && (
        <p className="-mt-3 mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-ui text-[12.5px] text-iron-400">
          <span className="micro-label text-paper-100">{t('platform.comptoir.signedOutBadge')}</span>
          <span>{t('platform.comptoir.signedOutNote')}</span>
          <Link to="/account" className="text-paper-100 underline decoration-[var(--gz-ink-soft)] underline-offset-4 transition-colors hover:decoration-[var(--gz-ink)]">
            {t('platform.action.signIn')} →
          </Link>
        </p>
      )}

      {/* the engraving (1536×640), veiled towards the page at its foot: a
          light veil, so the day's page does not wash the plate out */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease }} className="gz-engraving relative h-36 sm:h-52">
        <img src="/comptoir-hero.png" alt="" />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(var(--lacquer-900)/0) 0%, rgb(var(--lacquer-900)/.12) 62%, rgb(var(--lacquer-900)/.4) 100%)' }} />
      </motion.div>

      {/* the one fact that stops a purchase: the page's one full frame */}
      {!COUNTER_OPEN && (
        <div role="status" className="console console-ruled mt-6 flex flex-wrap items-center gap-3 px-5 py-4">
          <Clock size={16} aria-hidden className="shrink-0 text-brass-300" />
          <span className="micro-label text-paper-100">{t('platform.comptoir.standbyBadge')}</span>
          <span className="min-w-0 flex-1 font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.comptoir.standbyNote')}</span>
        </div>
      )}

      <div className="mt-8 grid gap-8 min-[900px]:grid-cols-12">
        <div className="min-w-0 min-[900px]:col-span-8">
          <Tabs groupId="comptoir" ariaLabel={t('platform.comptoir.title')} active={tab} onChange={(id) => setTab(id as Category)} tabs={SHOWN_CATEGORIES.map((c) => ({ id: c, label: t(`platform.comptoir.tabs.${c}`) }))} />
          <TabPanel groupId="comptoir" id={tab} key={tab} className="mt-6 grid gap-4 min-[640px]:grid-cols-2 min-[900px]:grid-cols-3">
            {items.map((item, i) => (
              <ShopItemCard key={item.id} item={item} index={i} wallet={wallet} opts={opts} canBuy={session !== null} onBuy={setBuying} onEquip={doEquip} />
            ))}
          </TabPanel>
        </div>

        <div className="grid content-start gap-6 min-[900px]:col-span-4">
          {COUNTER_OPEN && <MemberPreview wallet={wallet} />}
          <Earnings />
        </div>
      </div>

      {/* confirmation d'achat : solde avant / après */}
      <Modal open={buying !== null} onClose={() => !busy && setBuying(null)} title={buying ? t('platform.comptoir.buyTitle', { name: t(`platform.comptoir.items.${buying.id}`) }) : undefined}>
        {buying && (
          <>
            <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.comptoir.buyCopy')}</p>
            <dl className="mt-4 grid gap-2 border border-[rgb(var(--paper-100)/.07)] bg-enamel-850 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-ui text-[13px] text-iron-400">{t('platform.comptoir.balanceBefore')}</dt>
                <dd className="data-text tnums text-paper-100">{wallet.balance}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-ui text-[13px] text-iron-400">{t(`platform.comptoir.items.${buying.id}`)}</dt>
                <dd className="data-text tnums text-rust-400">-{buying.price}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[rgb(var(--paper-100)/.07)] pt-2">
                <dt className="font-ui text-[13px] font-semibold text-paper-100">{t('platform.comptoir.balanceAfter')}</dt>
                <dd className="data-text tnums font-medium text-brass-300">{wallet.balance - buying.price}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="ticket-brass" icon={<Coins size={16} aria-hidden />} disabled={busy} onClick={() => void confirmBuy()}>
                {t('platform.comptoir.confirm')}
              </Button>
              <Button variant="ticket" disabled={busy} onClick={() => setBuying(null)}>
                {t('platform.comptoir.cancel')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </PageShell>
  );
}
