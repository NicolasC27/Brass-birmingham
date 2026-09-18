import Anthropic from '@anthropic-ai/sdk';
import type { Lang } from '@/forum/types';

/* ------------------------------------------------------------------ */
/* The interpreter.                                                    */
/*                                                                     */
/* A forum post written in one of the club's tongues, read in another: */
/* Claude renders it, keeping the marks of the little markup and the   */
/* game's own words. The office asks once per post and per language    */
/* and keeps the answer; what it costs is counted from the tokens the  */
/* answer reports, against a budget the house sets. No key, no         */
/* interpreter: everyone reads the original.                           */
/* ------------------------------------------------------------------ */

export interface Rendering {
  text: string;
  tokensIn: number;
  tokensOut: number;
}
export interface Translator {
  readonly model: string;
  translate(text: string, from: Lang, to: Lang): Promise<Rendering>;
}

export const DEFAULT_MODEL = 'claude-opus-5';
/** dollars per million tokens, in and out */
export const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
/** what a rendering cost, in dollars */
export const costOf = (model: string, tokensIn: number, tokensOut: number): number => {
  const p = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
};

const NAMES: Record<Lang, string> = { en: 'English', fr: 'French', de: 'German', es: 'Spanish' };

/* the game's words, so a rendering says what the box and the site say */
const GLOSSARY = `Brass: Birmingham terms — use the established term of the target language:
canal era / rail era (FR ère du canal / ère du rail; DE Kanalzeit / Eisenbahnzeit; ES era del canal / era del ferrocarril)
coal mine (FR mine de charbon; DE Kohlemine; ES mina de carbón), iron works (FR fonderie; DE Eisenwerk; ES fundición)
cotton mill (FR filature; DE Baumwollspinnerei; ES fábrica de algodón), manufacturer (FR manufacture; DE Manufaktur; ES manufactura)
pottery (FR poterie; DE Töpferei; ES alfarería), brewery (FR brasserie; DE Brauerei; ES cervecería), beer barrel (FR baril de bière; DE Bierfass; ES barril de cerveza)
link (FR lien; DE Verbindung; ES enlace), network (FR réseau; DE Netz; ES red), merchant (FR marchand; DE Händler; ES mercader)
to flip a tile (FR retourner une tuile; DE ein Plättchen umdrehen; ES voltear una loseta), income (FR revenu; DE Einkommen; ES ingresos)
victory points, VP (FR points de victoire, PV; DE Siegpunkte, SP; ES puntos de victoria, PV), loan (FR emprunt; DE Darlehen; ES préstamo)
develop (FR développer; DE entwickeln; ES desarrollar), sell (FR vendre; DE verkaufen; ES vender), market (FR bourse; DE Markt; ES mercado)
Town names (Birmingham, Coalbrookdale, Stoke-on-Trent…) stay as they are.`;

const system = (from: Lang, to: Lang): string =>
  `You translate posts from a board-game club's forum from ${NAMES[from]} to ${NAMES[to]}.
Return only the translation, nothing else: no preamble, no notes, no quotation marks around it.
Keep the writer's tone and register, and their line breaks and paragraphs.
The text carries a little markup that must survive unchanged: **bold**, _italic_, \`code\`, lines that start with "> " (quotes), and web addresses. Do not add markup.
Leave names of people and places as they are.
${GLOSSARY}`;

/** the interpreter, when the house has a key for it (ANTHROPIC_API_KEY); null otherwise */
export function claudeTranslator(model = process.env.TRANSLATE_MODEL || DEFAULT_MODEL): Translator | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  return {
    model,
    async translate(text, from, to) {
      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        system: system(from, to),
        /* a rendering is not a puzzle: little thinking, all of it on the words */
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: text }],
      });
      if (response.stop_reason === 'refusal') throw new Error('refused');
      const out = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!out) throw new Error('empty');
      return { text: out, tokensIn: response.usage.input_tokens, tokensOut: response.usage.output_tokens };
    },
  };
}
