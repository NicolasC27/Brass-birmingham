import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Check, Coins } from 'lucide-react';
import Button from '@/components/platform/Button';
import EmptyState from '@/components/platform/EmptyState';
import MemberAvatar from '@/components/platform/MemberAvatar';
import Modal from '@/components/platform/Modal';
import Tabs from '@/components/platform/Tabs';
import Toast, { type ToastData } from '@/components/platform/Toast';
import { CATALOG, type Category, type Rarity, type ShopItem } from '@/platform/catalog';
import { buy, collectRewards, equip, isDailyAvailable, useWallet, type Wallet } from '@/platform/wallet';
import { loadIdentity } from '@/online/identity';
import { useSession } from '@/online/session';
import { useLang, useT, tr } from '@/i18n';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* /comptoir — la boutique du club (comptoir.md). Jetons de laiton    */
/* gagnés aux tables contre avatars gravés, cadres et titres.          */
/* Cosmétique uniquement : zéro impact sur le jeu.                     */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;

const RARITY_STYLE: Record<Rarity, string> = {
  common: 'text-brass-300',
  rare: 'text-bottle-400',
  prestige: 'text-signal-400',
};

function itemName(id: string): string {
  return tr(`platform.comptoir.items.${id}`);
}

/* ------------------------------ En-tête ------------------------------ */

function Header({ wallet }: { wallet: Wallet }) {
  const t = useT();
  const reduced = useReducedMotion();
  const daily = isDailyAvailable(wallet);

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
          <p className="data-text text-[11px] text-iron-400">{t('platform.comptoir.lifetime', { count: wallet.lifetime })}</p>
          <span
            className={cn(
              'micro-label flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              daily ? 'border-bottle-500/60 bg-bottle-700/40 text-bottle-400' : 'border-[rgb(var(--paper-100)/.12)] text-iron-400',
            )}
          >
            {daily ? <Coins size={11} aria-hidden /> : <Check size={11} aria-hidden />}
            {t('platform.comptoir.daily.label')} · {t(daily ? 'platform.comptoir.daily.available' : 'platform.comptoir.daily.claimed')}
          </span>
        </motion.div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="micro-label rounded bg-rust-700/50 px-1.5 py-0.5 text-rust-400">{t('platform.comptoir.localBadge')}</span>
        <span className="font-ui text-[12px] text-iron-400">{t('platform.comptoir.localNote')}</span>
      </div>
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
  /* titre honorifique : plaque gravée */
  return (
    <span className="flex h-24 w-full items-center justify-center">
      <span className="rounded-lg border border-brass-hairline-strong bg-enamel-800 px-4 py-2 text-center">
        <span className="micro-label text-brass-300">{itemName(item.id)}</span>
      </span>
    </span>
  );
}

function ShopItemCard({
  item,
  index,
  wallet,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  index: number;
  wallet: Wallet;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
}) {
  const t = useT();
  const owned = wallet.owned.includes(item.id);
  const equipped = wallet.equipped[item.category] === item.id;
  const affordable = wallet.balance >= item.price;
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
      </div>

      <p className={cn('data-text flex items-center gap-1.5 text-[13px]', !owned && !affordable && item.price > 0 ? 'text-rust-400' : 'text-paper-100')}>
        <Coins size={14} aria-hidden className={!owned && !affordable && item.price > 0 ? 'text-rust-400' : 'text-brass-300'} />
        {item.price === 0 ? t('platform.comptoir.free') : item.price}
      </p>

      {equipped ? (
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-bottle-700/50 px-4 font-ui text-[14px] font-semibold text-bottle-400" aria-current="true">
          <Check size={16} aria-hidden />
          {t('platform.comptoir.equipped')}
        </span>
      ) : owned ? (
        <Button variant="ghost" onClick={() => onEquip(item)}>
          {t('platform.comptoir.equip')}
        </Button>
      ) : (
        <Button variant="primary" disabled={!affordable} title={!affordable ? t('platform.comptoir.insufficient') : undefined} onClick={() => onBuy(item)}>
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
            <p className="tnums font-fraunces text-[24px] font-semibold leading-none text-paper-100">{wallet.lifetime}</p>
            <p className="micro-label mt-1.5 text-iron-400">{t('platform.comptoir.preview.lifetime')}</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

/* ------------------------- Historique de la bourse ------------------------- */

function WalletLedger({ wallet }: { wallet: Wallet }) {
  const t = useT();
  const lang = useLang();
  const entries = [...wallet.ledger].reverse().slice(0, 10);

  return (
    <section aria-label={t('platform.comptoir.ledger.title')} className="relative overflow-hidden rounded-xl border border-brass-hairline bg-enamel-850 p-5">
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <h2 className="title-card">{t('platform.comptoir.ledger.title')}</h2>
        <div className="mb-3 mt-3 h-px bg-brass-hairline" />
        {entries.length === 0 ? (
          <EmptyState mini icon={<Coins size={20} aria-hidden />} title={t('platform.comptoir.ledger.empty')} className="!py-6" />
        ) : (
          <ul className="grid gap-2">
            {entries.map((e, i) => {
              const when = new Date(e.at);
              const stamp = `${when.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' })} · ${when.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`;
              return (
                <li key={`${e.at}-${i}`} className="flex items-baseline gap-3">
                  <span className={cn('data-text w-14 shrink-0 text-right text-[13px] font-medium', e.delta >= 0 ? 'text-bottle-400' : 'text-rust-400')}>
                    {e.delta >= 0 ? `+${e.delta}` : e.delta}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-ui text-[13px] text-paper-300">{e.reason}</span>
                  <span className="data-text shrink-0 text-[11px] text-iron-600">{stamp}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export default function Comptoir() {
  const t = useT();
  const wallet = useWallet();
  const [tab, setTab] = useState<Category>('avatar');
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (message: string, kind: ToastData['kind'] = 'success') => setToast({ id: Date.now(), message, kind });

  /* Encaissement au montage — idempotent (processed), toast du gain. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      const gain = collectRewards();
      if (gain) showToast(tr('platform.comptoir.toastCollected', { count: gain.delta }));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const confirmBuy = () => {
    if (!buying) return;
    const name = itemName(buying.id);
    if (buy(buying.id, name)) showToast(tr('platform.comptoir.toastBought', { name }));
    else showToast(tr('platform.comptoir.toastFailed'), 'error');
    setBuying(null);
  };

  const doEquip = (item: ShopItem) => {
    if (equip(item.id)) showToast(tr('platform.comptoir.toastEquipped', { name: itemName(item.id) }), 'info');
  };

  const items = CATALOG.filter((i) => i.category === tab);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-10 sm:px-8">
      <Header wallet={wallet} />

      {/* bandeau gravure (1536×640), masque dégradé vers la laque */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease }} className="relative mt-6 overflow-hidden rounded-xl border border-brass-hairline">
        <img src="/comptoir-hero.png" alt="" className="h-36 w-full object-cover sm:h-52" />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(var(--lacquer-900)/.18) 0%, rgb(var(--lacquer-900)/.55) 62%, rgb(var(--lacquer-900)/.92) 100%)' }} />
      </motion.div>

      <div className="mt-8 grid gap-8 min-[1100px]:grid-cols-12">
        <div className="min-w-0 min-[1100px]:col-span-8">
          <Tabs
            groupId="comptoir"
            active={tab}
            onChange={(id) => setTab(id as Category)}
            tabs={[
              { id: 'avatar', label: t('platform.comptoir.tabs.avatar') },
              { id: 'frame', label: t('platform.comptoir.tabs.frame') },
              { id: 'title', label: t('platform.comptoir.tabs.title') },
            ]}
          />
          <div key={tab} className="mt-6 grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
            {items.map((item, i) => (
              <ShopItemCard key={item.id} item={item} index={i} wallet={wallet} onBuy={setBuying} onEquip={doEquip} />
            ))}
          </div>
        </div>

        <div className="grid content-start gap-6 min-[1100px]:col-span-4">
          <MemberPreview wallet={wallet} />
          <WalletLedger wallet={wallet} />
        </div>
      </div>

      {/* confirmation d'achat : solde avant / après */}
      <Modal open={buying !== null} onClose={() => setBuying(null)} title={buying ? t('platform.comptoir.buyTitle', { name: t(`platform.comptoir.items.${buying.id}`) }) : undefined}>
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
              <Button variant="primary" icon={<Coins size={16} aria-hidden />} onClick={confirmBuy}>
                {t('platform.comptoir.confirm')}
              </Button>
              <Button variant="ghost" onClick={() => setBuying(null)}>
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
