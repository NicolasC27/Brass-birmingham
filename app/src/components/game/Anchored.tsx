import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { AnchorRegistry, MapAnchor } from './boardView';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* A piece of HUD hung from a point of the map. The board's ticker     */
/* moves every registered element in the same frame it moves the map, */
/* so the two never part; React decides only what hangs there, and    */
/* never writes a position of its own that a later frame would have   */
/* to correct.                                                        */
/* ------------------------------------------------------------------ */

type Props = HTMLAttributes<HTMLDivElement> & {
  anchors: AnchorRegistry;
  at: MapAnchor;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function Anchored({ anchors, at, className, style, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { wx, wy, px, py, clampX } = at;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return anchors.register(el, { wx, wy, px, py, clampX });
  }, [anchors, wx, wy, px, py, clampX]);
  return (
    <div ref={ref} className={cn('absolute', className)} style={style} {...rest}>
      {children}
    </div>
  );
}
