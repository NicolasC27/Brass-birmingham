import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import MemberAvatar from '@/components/platform/MemberAvatar';
import { useWallet } from '@/platform/wallet';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* The member's plate — the head of the desk and of the profile.       */
/*                                                                     */
/* Both counters used to cut their own: 24 px of padding here and 32   */
/* there, a 64 px portrait against an 88, a 28 px name against a 36,  */
/* so the text started 38 px further right on one page than on the     */
/* other. One plate now, one set of measures; each page brings only    */
/* what it says under the name and what it hangs on the right.         */
/*                                                                     */
/* The ledger paper is laid once, from the left edge: the sheet        */
/* carries its margin rule 44 px in, and repeating the sheet across a  */
/* wide plate printed that rule again every 512 px, a seam the night   */
/* showed plainly. The paper now fades out before its first repeat.    */
/* ------------------------------------------------------------------ */

const ease = 'easeOut' as const;
const AVATAR = 80;

/** the paper's own width, where the first repeat (and its margin rule) would fall */
const SHEET_FADE = 'linear-gradient(to right, #000 0, #000 360px, transparent 500px)';

export default function MemberPlate({
  eyebrow,
  name,
  presence,
  children,
  aside,
  className,
}: {
  eyebrow: string;
  name: string;
  /** a mark on the portrait (the lamp that says the member is here) */
  presence?: ReactNode;
  /** what the page says under the name: one line of data, a motto */
  children?: ReactNode;
  /** what hangs at the right of the plate */
  aside?: ReactNode;
  className?: string;
}) {
  const wallet = useWallet();
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }} className={cn('relative overflow-hidden console', className)}>
      <div aria-hidden className="tex-ledger pointer-events-none absolute inset-0 bg-repeat-y opacity-50" style={{ maskImage: SHEET_FADE, WebkitMaskImage: SHEET_FADE }} />
      <div className="relative flex flex-wrap items-center gap-x-8 gap-y-6 p-6 lg:p-8">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.26, ease }} className="relative shrink-0">
          <MemberAvatar avatar={wallet.equipped.avatar} frame={wallet.equipped.frame} size={AVATAR} />
          {presence}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.06 }} className="min-w-0 flex-1 basis-64">
          <p className="eyebrow-fell">{eyebrow}</p>
          <h1 className="display-page mt-1 truncate">{name}</h1>
          {children}
        </motion.div>

        {aside}
      </div>
    </motion.section>
  );
}

/** the line of plain words under the name: the title worn, the year of entry, the company */
export function PlateLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-1.5 font-ui text-[12px] leading-snug text-iron-400', className)}>{children}</p>;
}
