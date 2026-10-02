/* ------------------------------------------------------------------ */
/* The telegraph to Discord. With DISCORD_WEBHOOK_URL set, the house   */
/* posts its dispatches and its Monday edition to the club's channel — */
/* a few lines at a time, a minute apart at most, so a busy evening    */
/* never floods it. Without the address nothing leaves.                */
/* ------------------------------------------------------------------ */

export interface Telegraph {
  /** a line for the channel, sent with the next flush */
  post(line: string): void;
  /** a whole message, sent at once */
  send(text: string): Promise<void>;
  close(): void;
}

const FLUSH_MS = 60_000;
const LINES = 8;

export function telegraphFromEnv(env: NodeJS.ProcessEnv = process.env): Telegraph {
  const url = env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return { post: () => undefined, send: async () => undefined, close: () => undefined };
  return discordTelegraph(url);
}

export function discordTelegraph(url: string, flushMs = FLUSH_MS): Telegraph {
  let queue: string[] = [];
  const send = async (text: string): Promise<void> => {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900) }) });
      if (!res.ok) console.warn(`discord: ${res.status}`);
    } catch (e) {
      console.warn('discord: the wire is down', e instanceof Error ? e.message : e);
    }
  };
  const timer = setInterval(() => {
    if (!queue.length) return;
    const lines = queue.slice(0, LINES);
    queue = queue.slice(LINES);
    void send(lines.join('\n'));
  }, flushMs);
  return {
    post: (line) => {
      queue.push(line);
    },
    send,
    close: () => clearInterval(timer),
  };
}
