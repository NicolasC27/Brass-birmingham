import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Check, Coins } from 'lucide-react';
import Button from '@/components/platform/Button';
import MemberAvatar from '@/components/platform/MemberAvatar';
import Modal from '@/components/platform/Modal';
import Tabs from '@/components/platform/Tabs';
import Toast, { type ToastData } from '@/components/platform/Toast';
import { setBoardOption, useBoardOptions, type BoardOptions, type RailPainting } from '@/components/game/boardOptions';
import type { SlotArt } from '@/gl/faces';
import { CATALOG, CATEGORIES, type Category, type Rarity, type ShopItem } from '@/platform/catalog';
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
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

const RARITY_STYLE: Record<Rarity, string> = {
  common: 'text-brass-300',
  rare: 'text-bottle-400',
  prestige: 'text-signal-400',
};

/** les objets en image, comme au comptoir du hall */
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

/** les catégories dont le choix équipé est une préférence locale (carte de membre) */
const LOCAL_WEAR: ReadonlySet<Category> = new Set<Category>(['avatar', 'frame', 'title']);
/** celles qui s'affichent avec une description sous le nom */
const WITH_BLURB: ReadonlySet<Category> = new Set<Category>(['sign', 'painting', 'portrait', 'tiles']);

type BoardWear = { key: 'railPainting'; value: RailPainting } | { key: 'slotArt'; value: SlotArt };

/** ce que porter un objet change sur le plateau, quand ça change quelque chose */
function boardWear(item: ShopItem): BoardWear | null {
  if (item.category === 'painting') return { key: 'railPainting', value: item.id.slice(-1) as RailPainting };
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

/* ------------------------------ En-tête ------------------------------ */

function Header({ wallet, signedIn }: { wallet: Wallet; signedIn: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();

  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="micro-label text-brass-300">{t('platform.comptoir.eyebrow')}</p>
          <h1 className="display-page mt-1">{t('platform.comptoir.title')}</h1>
          <p className="mt-2 max-w-xl font-ui text-[15px] leading-relaxed text-paper-300">{t('platform.comptoir.lede')}</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }} className="flex flex-col items-end gap-2">
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
          <p className="data-text text-[11px] text-iron-400">{t('platform.comptoir.hint', { sitting: GUINEAS.sitting, win: GUINEAS.win })}</p>
        </motion.div>
      </div>

      {!signedIn && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="micro-label rounded bg-rust-700/50 px-1.5 py-0.5 text-rust-400">{t('platform.comptoir.signedOutBadge')}</span>
          <span className="font-ui text-[12px] text-iron-400">{t('platform.comptoir.signedOutNote')}</span>
        </div>
      )}
    </header>
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
        <span className="rounded-lg border border-brass-hairline-strong bg-enamel-800 px-4 py-2 text-center">
          <span className="micro-label text-brass-300">{itemName(item.id)}</span>
        </span>
      </span>
    );
  }
  /* enseigne, peinture, portrait, tuiles : l'image du hall */
  const tiles = item.category === 'tiles';
  return (
    <span className={cn('block w-full overflow-hidden rounded-lg border border-brass-hairline bg-enamel-900', tiles ? 'flex h-32 items-center justify-center' : 'aspect-[4/3]')}>
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
      className="flex flex-col items-center gap-3 rounded-xl border border-brass-hairline bg-enamel-850 p-4 transition-colors duration-150 ease-out hover:border-brass-hairline-strong hover:bg-enamel-800"
    >
      <ItemVisual item={item} equippedAvatar={wallet.equipped.avatar} />

      <div className="text-center">
        <h3 className="title-card">{name}</h3>
        <p className={cn('micro-label mt-1', RARITY_STYLE[item.rarity])}>{t(`platform.comptoir.rarity.${item.rarity}`)}</p>
        {WITH_BLURB.has(item.category) && <p className="mt-2 font-ui text-[12px] leading-relaxed text-paper-300">{t(`platform.comptoir.blurbs.${item.id}`)}</p>}
      </div>

      <p className={cn('data-text mt-auto flex items-center gap-1.5 text-[13px]', short ? 'text-rust-400' : 'text-paper-100')}>
        <Coins size={14} aria-hidden className={short ? 'text-rust-400' : 'text-brass-300'} />
        {item.price === 0 ? t('platform.comptoir.free') : item.price}
      </p>

      {equipped ? (
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-bottle-700/50 px-4 font-ui text-[14px] font-semibold text-bottle-400" aria-current="true">
          <Check size={16} aria-hidden />
          {t('platform.comptoir.equipped')}
        </span>
      ) : owned ? (
        wearable ? (
          <Button variant="ghost" onClick={() => onEquip(item)}>
            {t('platform.comptoir.equip')}
          </Button>
        ) : (
          <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-brass-hairline px-4 font-ui text-[14px] font-semibold text-paper-300">
            <BadgeCheck size={16} aria-hidden className="text-brass-300" />
            {t('platform.comptoir.owned')}
          </span>
        )
      ) : (
        <Button
          variant="primary"
          disabled={!canBuy || !affordable}
          title={!canBuy ? t('platform.comptoir.signedOutNote') : !affordable ? t('platform.comptoir.insufficient') : undefined}
          onClick={() => onBuy(item)}
        >
          {t('platform.comptoir.buy')}
        </Button>
      )}
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
      className="relative overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850 p-6 min-[1100px]:sticky min-[1100px]:top-24"
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
    <section aria-label={t('platform.comptoir.earn.title')} className="relative overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850 p-5">
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <h2 className="title-card">{t('platform.comptoir.earn.title')}</h2>
        <div className="mb-3 mt-3 h-px bg-brass-hairline" />
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline gap-3">
              <span className="data-text w-14 shrink-0 text-right text-[13px] font-medium text-bottle-400">{r.value}</span>
              <span className="min-w-0 flex-1 font-ui text-[13px] text-paper-300">{r.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-ui text-[12px] text-iron-400">{t('platform.comptoir.earn.note')}</p>
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
  const [tab, setTab] = useState<Category>('avatar');
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
      /* peinture ou tuiles : c'est le plateau qui les porte */
      if (w.key === 'railPainting') setBoardOption('railPainting', w.value);
      else setBoardOption('slotArt', w.value);
      showToast(tr('platform.comptoir.toastEquipped', { name: itemName(item.id) }), 'info');
      return;
    }
    if (equip(item.id)) showToast(tr('platform.comptoir.toastEquipped', { name: itemName(item.id) }), 'info');
  };

  const items = CATALOG.filter((i) => i.category === tab);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-10 sm:px-8">
      <Header wallet={wallet} signedIn={session !== null} />

      {/* bandeau gravure (1536×640), masque dégradé vers la laque */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease }} className="relative mt-6 overflow-hidden rounded-xl border border-brass-hairline">
        <img src="/comptoir-hero.png" alt="" className="h-36 w-full object-cover sm:h-52" />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(var(--lacquer-900)/.18) 0%, rgb(var(--lacquer-900)/.55) 62%, rgb(var(--lacquer-900)/.92) 100%)' }} />
      </motion.div>

      <div className="mt-8 grid gap-8 min-[1100px]:grid-cols-12">
        <div className="min-w-0 min-[1100px]:col-span-8">
          <Tabs groupId="comptoir" active={tab} onChange={(id) => setTab(id as Category)} tabs={CATEGORIES.map((c) => ({ id: c, label: t(`platform.comptoir.tabs.${c}`) }))} />
          <div key={tab} className="mt-6 grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
            {items.map((item, i) => (
              <ShopItemCard key={item.id} item={item} index={i} wallet={wallet} opts={opts} canBuy={session !== null} onBuy={setBuying} onEquip={doEquip} />
            ))}
          </div>
        </div>

        <div className="grid content-start gap-6 min-[1100px]:col-span-4">
          <MemberPreview wallet={wallet} />
          <Earnings />
        </div>
      </div>

      {/* confirmation d'achat : solde avant / après */}
      <Modal open={buying !== null} onClose={() => !busy && setBuying(null)} title={buying ? t('platform.comptoir.buyTitle', { name: t(`platform.comptoir.items.${buying.id}`) }) : undefined}>
        {buying && (
          <>
            <p className="font-ui text-[13px] leading-relaxed text-paper-300">{t('platform.comptoir.buyCopy')}</p>
            <dl className="mt-4 grid gap-2 rounded-lg border border-[rgb(var(--paper-100)/.07)] bg-enamel-850 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-ui text-[13px] text-iron-400">{t('platform.comptoir.balanceBefore')}</dt>
                <dd className="data-text tnums text-[13px] text-paper-100">{wallet.balance}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-ui text-[13px] text-iron-400">{t(`platform.comptoir.items.${buying.id}`)}</dt>
                <dd className="data-text tnums text-[13px] text-rust-400">-{buying.price}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[rgb(var(--paper-100)/.07)] pt-2">
                <dt className="font-ui text-[13px] font-semibold text-paper-100">{t('platform.comptoir.balanceAfter')}</dt>
                <dd className="data-text tnums text-[13px] font-medium text-brass-300">{wallet.balance - buying.price}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="primary" icon={<Coins size={16} aria-hidden />} disabled={busy} onClick={() => void confirmBuy()}>
                {t('platform.comptoir.confirm')}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setBuying(null)}>
                {t('platform.comptoir.cancel')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
