import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { PERSONA_IDS } from '@/game/data';
import type { BotPersona } from '@/game/types';
import { launchScenario } from './launch';
import type { LaunchAsk, LaunchStep } from './launch';

/* ------------------------------------------------------------------ */
/* The launcher's state, shared by the bench page and the drawer at    */
/* the table: what is being played forward, how far, what went wrong, */
/* and the table opened once it is written.                            */
/* ------------------------------------------------------------------ */

export interface BenchChoice {
  preset: string;
  seats: number;
  owner: number;
  personas: BotPersona[];
  /** empty: a fresh seed each time */
  seed: string;
}

const KEY = 'brassworks.bench.v1';

export const DEFAULT_CHOICE: BenchChoice = { preset: 'canal-mid', seats: 3, owner: 0, personas: ['wedgwood', 'arkwright', 'watt'], seed: '' };

/** the bench's last choices, a convenience of this browser */
export function readChoice(): BenchChoice {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = { ...DEFAULT_CHOICE, ...(JSON.parse(raw) as Partial<BenchChoice>) };
      return { ...c, personas: [0, 1, 2].map((i) => (PERSONA_IDS.includes(c.personas[i]) ? c.personas[i] : DEFAULT_CHOICE.personas[i])) };
    }
  } catch {
    /* private mode, or a note from an older bench */
  }
  return DEFAULT_CHOICE;
}

export function keepChoice(c: BenchChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* non-fatal */
  }
}

/** what the launcher says while it works */
export function stepText(s: LaunchStep): string {
  return s.stage === 'play' ? `Les machines jouent… ${Math.round(s.share * 100)} %` : `Envoi à l’office… ${Math.round(s.share * 100)} %`;
}

export function useLaunch() {
  const navigate = useNavigate();
  const [step, setStep] = useState<LaunchStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ code: string; moves: number; seed: number; ms: number } | null>(null);
  const run = useCallback(
    async (ask: LaunchAsk) => {
      setError(null);
      const t0 = performance.now();
      try {
        const r = await launchScenario(ask, setStep);
        setLast({ ...r, ms: Math.round(performance.now() - t0) });
        setStep(null);
        navigate(`/game/local/${r.code}`);
      } catch (e) {
        setStep(null);
        setError((e as Error).message);
      }
    },
    [navigate],
  );
  return { run, step, error, last, busy: step !== null };
}
