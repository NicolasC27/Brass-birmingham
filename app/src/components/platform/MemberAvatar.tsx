import { useState } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* MemberAvatar — a member's likeness on a card: the picture the       */
/* office serves (one of the house's heads, or their own), and the     */
/* engraved iron pawn for whoever has none, or whose picture does not  */
/* come back.                                                          */
/* ------------------------------------------------------------------ */

export interface MemberAvatarProps {
  /** the likeness: a data URL, or the office's address for it */
  src?: string | null;
  size?: number;
  className?: string;
}

export default function MemberAvatar({ src = null, size = 64, className }: MemberAvatarProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const shown = src && broken !== src ? src : '/avatar-iron.svg';
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)} style={{ width: size, height: size }}>
      <img src={shown} alt="" width={size} height={size} draggable={false} onError={() => src && setBroken(src)} className="h-full w-full rounded-full object-cover" />
    </span>
  );
}
