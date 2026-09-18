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

/** bumped when the instructions change: renderings made under an older
 *  version are made again when next read */
export const PROMPT_VERSION = 2;

/* the game's words, so a rendering says what the box and the site say */
const GLOSSARY = `Glossary — always use the established term of the target language (English / French / German / Spanish):
- canal era / rail era: ère du canal / ère du rail; Kanalzeit / Eisenbahnzeit; era del canal / era del ferrocarril
- coal mine: mine de charbon; Kohlemine; mina de carbón
- iron works: fonderie; Eisenwerk; fundición
- cotton mill: filature; Baumwollspinnerei; fábrica de algodón
- manufacturer (the goods works): manufacture; Manufaktur; manufactura
- pottery: poterie; Töpferei; alfarería
- brewery: brasserie; Brauerei; cervecería — beer barrel: baril de bière; Bierfass; barril de cerveza
- link (canal or rail between two towns): lien; Verbindung; enlace — network: réseau; Netz; red
- merchant (the trading houses at the map's edge): marchand; Händler; mercader
- to flip a tile (a works that has sold out turns face down): retourner une tuile; ein Plättchen umdrehen; voltear una loseta
- income: revenu; Einkommen; ingresos — loan: emprunt; Darlehen; préstamo
- victory points, VP: points de victoire, PV; Siegpunkte, SP; puntos de victoria, PV
- develop (discard a tile from the mat): développer; entwickeln; desarrollar — sell: vendre; verkaufen; vender
- the coal and iron market: la bourse du charbon et du fer; der Kohle- und Eisenmarkt; el mercado de carbón y hierro
- level (of a works, 1 to 4): niveau; Stufe; nivel — tile: tuile; Plättchen; loseta — card (location or industry card): carte; Karte; carta
- Town names stay as they are: Birmingham, Coventry, Coalbrookdale, Stoke-on-Trent, Burton-on-Trent, Derby, Nottingham, Walsall, Wolverhampton, Kidderminster, Worcester, Gloucester, Oxford, Warrington, Shrewsbury…`;

const system = (from: Lang, to: Lang): string =>
  `You are the interpreter of a members' forum about the board game Brass: Birmingham — an economic strategy game set in the English Midlands during the Industrial Revolution, where players build coal mines, iron works, cotton mills, potteries, breweries and manufacturers, link towns by canal and then by rail, and sell to merchants. Everything you translate is about that game or the club around it: read every ambiguous word in that light (a "link" joins two towns, "iron" and "coal" are cubes on the market, a "flip" turns a tile, "beer" pays for a sale, "income" is the track).

Translate the member's post from ${NAMES[from]} to ${NAMES[to]}.

How to translate:
- Say what the writer says, in the way a native ${NAMES[to]}-speaking player would say it at the club: natural and idiomatic, never word for word, never stiff.
- Keep the writer's tone and register — casual stays casual, precise stays precise, humour stays humour, a question stays a question.
- Use the game's established terms of the target language (glossary below), consistently; do not invent alternatives.
- Keep everything that is not language exactly as it is: names of people and towns, numbers, prices (£), scores, dates, addresses.
- Keep the layout: the same paragraphs, the same line breaks, the same order.
- The text carries a little markup that must survive unchanged around the same words: **bold**, _italic_, \`code\`, lines beginning with "> " (quotes), and web addresses. Add none.
- If something cannot be rendered well, prefer the plainest faithful rendering; never add explanations, notes, brackets or comments.

Output only the translation — no preamble, no title, no quotation marks around it, nothing after it.

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
