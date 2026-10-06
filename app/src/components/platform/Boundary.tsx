import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { tr } from '@/i18n';

/* ------------------------------------------------------------------ */
/* The boundary.                                                       */
/*                                                                     */
/* A throw anywhere under it used to take the whole screen with it and */
/* leave a reader staring at nothing. It takes the panel it guards     */
/* instead, says so plainly, and says the one thing that matters: the  */
/* game is at the office, and nothing of it went with the page.        */
/*                                                                     */
/* `onQuit`, where a panel has somewhere to go back to, closes it      */
/* rather than offering to reload the world.                           */
/* ------------------------------------------------------------------ */

interface Props {
  children: ReactNode;
  /** what to do instead of reloading: close the panel and stand where it stood */
  onQuit?: () => void;
  /** the label of that way out */
  quitLabel?: string;
}

interface State {
  error: Error | null;
}

export default class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    /* a stack worth seeing, not swallowing */
    console.error('the page stopped short:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { onQuit, quitLabel } = this.props;
    return (
      <div role="alert" className="mx-auto flex max-w-[560px] flex-col items-start gap-3 px-6 py-12">
        <h2 className="display-hero text-[22px]">{tr('platform.boundary.title')}</h2>
        <p className="font-ui text-[14px] text-paper-300">{tr('platform.boundary.copy')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {onQuit ? (
            <button type="button" onClick={onQuit} className="btn-ledger">
              {quitLabel ?? tr('platform.boundary.home')}
            </button>
          ) : (
            <button type="button" onClick={() => window.location.reload()} className="btn-ledger">
              {tr('platform.boundary.reload')}
            </button>
          )}
          <a href="/" className="font-ui text-[13px] text-iron-400 hover:text-paper-100">
            {tr('platform.boundary.home')}
          </a>
        </div>
        <details className="mt-3 w-full">
          <summary className="cursor-pointer font-ui text-[12px] text-iron-400">{tr('platform.boundary.detail')}</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-coal-950 p-3 data-text text-[11px] text-iron-400">{error.message}</pre>
        </details>
      </div>
    );
  }
}
