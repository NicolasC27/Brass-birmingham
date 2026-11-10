import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* MemberAvatar — the engraved iron pawn on a member's card. The       */
/* counter no longer sells other pawns or frames: every member wears   */
/* the same, at the size the page asks for.                            */
/* ------------------------------------------------------------------ */

export interface MemberAvatarProps {
  size?: number;
  className?: string;
}

export default function MemberAvatar({ size = 64, className }: MemberAvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <img src="/avatar-iron.svg" alt="" width={size} height={size} className="h-full w-full rounded-full" />
    </span>
  );
}
