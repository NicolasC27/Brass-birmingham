import { useEffect, useState } from 'react';

/**
 * True while the tab is visible. Ambient animation layers use it to pause
 * when the tab is hidden (map-v3 §4 perf contract).
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}
