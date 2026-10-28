import { describe, expect, it } from 'vitest';
import { withEdition } from '@/game/actions';
import { newGame } from '@/game/engine';
import { passagesOf } from '@/game/faq';
import type { GameState, SetupPayload } from '@/game/types';
import { dictOf, trIn } from '@/i18n';
import type { Lang } from '@/i18n';
import { answerQuestion } from '../tableAnswers';

/* The free questions of the guided game's review, put at the guided table
   itself — you against Wedgwood, the canal era alone, the deal of seed 3 —
   as a reader types them, in the four tongues. Each has the answer it must
   get: '@money' is the table's own answer on the purse, a bare id is the
   notion of the guide's case that tells it.

   When the review ran them, 63 of its 173 phrasings in four tongues fell
   through: "Qui mène ?" read as the mines, "Un conseil ?" as the sale,
   "¿Qué debo hacer?" as the loan, and the end of this short game was told
   as the rail era's. Every one of them lands now. */

function guided(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

/** the answer a question gets at the table, as the lane and the tool
 *  give it: '@' and the table's question, or the notion that told it */
function answered(q: string, lang: Lang, g: GameState, aid = true): string {
  const t = (k: string, v?: Record<string, string | number>) => trIn(lang, k, v);
  const got = answerQuestion(q, { g, me: 0, aid }, t, lang, passagesOf((dictOf(lang) as { rules?: unknown }).rules));
  return got.intent ? `@${got.intent}` : (got.notion ?? (got.near.length ? 'near' : 'codex'));
}

/* the review's phrasings (ask-words.ts), by the answer each must get */
const PHRASINGS: Record<Lang, [string, string[]][]> = {
  fr: [
    ['@do', ['Qu’est-ce que je dois faire ?', 'Je fais quoi maintenant ?', 'Que jouer ?', 'Un conseil ?', 'Quel est le meilleur coup ?', 'Aide-moi']],
    ['@sell', ['Est-ce que je peux vendre ?', 'Puis-je vendre ?', 'Qu’est-ce que je peux vendre ?', 'Je peux vendre ma poterie ?', 'Pourquoi je ne peux pas vendre ?']],
    ['@build', ['Où je peux construire ?', 'Où puis-je construire ?', 'Où construire ?', 'Je peux construire quoi ?', 'Où bâtir ma forge ?']],
    ['@coal', ['Où est le charbon ?', 'Il reste du charbon ?', 'Où trouver du charbon ?', 'J’ai du charbon ?']],
    ['@beer', ['Où est la bière ?', 'J’ai de la bière ?', 'Où trouver de la bière ?', 'Il me faut de la bière']],
    ['@money', ['Combien j’ai d’argent ?', 'J’ai combien d’argent ?', 'Combien d’argent me reste-t-il ?', 'Quel est mon revenu ?', 'Je peux payer ?']],
    ['@rounds', ['Combien de manches restent ?', 'Il reste combien de manches ?', 'Combien de tours restent ?', 'Quand finit la partie ?', 'Combien d’actions il me reste ?']],
    ['@win', ['Combien de points j’ai ?', 'Quel est mon score ?', 'Qui gagne ?', 'Qui mène ?']],
    ['beer', ['C’est quoi la bière ?']],
    ['coal', ['Comment marche le charbon ?']],
    ['sell', ['Comment vendre ?']],
    ['iron', ['À quoi sert le fer ?']],
    ['coalMine', ['Pourquoi ma mine vend ses cubes ?']],
  ],
  en: [
    ['@do', ['What should I do?', 'What do I play now?', 'Any advice?', 'What now?', 'What is the best move?', 'Help me']],
    ['@sell', ['Can I sell?', 'What can I sell?', 'Can I sell my pottery?', 'Why can’t I sell?', 'Is there anything to sell?']],
    ['@build', ['Where can I build?', 'What can I build?', 'Where to build?', 'Can I build anything?', 'Where should I build my iron works?']],
    ['@coal', ['Where is the coal?', 'Where’s the coal?', 'Do I have coal?', 'Any coal left?', 'Where can I get coal?', 'Is there coal left?']],
    ['@beer', ['Where is the beer?', 'Where’s the beer?', 'Do I have beer?', 'Any beer left?', 'Where can I get beer?']],
    ['@money', ['How much money do I have?', 'How much money?', 'What is my income?', 'Can I afford it?', 'How much cash do I have?']],
    ['@rounds', ['How many rounds left?', 'How many rounds are left?', 'How long is left?', 'When does the game end?', 'How many actions left?']],
    ['@win', ['How many points do I have?', 'What is my score?', 'Who is winning?', 'Who’s winning?', 'Who leads?']],
    ['beer', ['What is beer?']],
    ['coal', ['How does coal work?']],
    ['sell', ['How do I sell?']],
    ['iron', ['What is iron for?']],
  ],
  de: [
    ['@do', ['Was soll ich tun?', 'Was soll ich jetzt machen?', 'Was spiele ich?', 'Hast du einen Tipp?', 'Was jetzt?', 'Welcher Zug ist am besten?']],
    ['@sell', ['Kann ich verkaufen?', 'Was kann ich verkaufen?', 'Kann ich meine Töpferei verkaufen?', 'Warum kann ich nicht verkaufen?']],
    ['@build', ['Wo kann ich bauen?', 'Was kann ich bauen?', 'Wo bauen?', 'Kann ich etwas bauen?', 'Wo soll ich meine Eisenhütte bauen?']],
    ['@coal', ['Wo ist die Kohle?', 'Habe ich Kohle?', 'Hab ich Kohle?', 'Ist noch Kohle da?', 'Gibt es noch Kohle?', 'Wo bekomme ich Kohle?']],
    ['@beer', ['Wo ist das Bier?', 'Habe ich Bier?', 'Ist noch Bier da?', 'Gibt es noch Bier?', 'Wo bekomme ich Bier?']],
    ['@money', ['Wie viel Geld habe ich?', 'Wieviel Geld hab ich?', 'Wie hoch ist mein Einkommen?', 'Kann ich das bezahlen?']],
    ['@rounds', ['Wie viele Runden bleiben?', 'Wie viele Runden noch?', 'Wie lange noch?', 'Wann endet das Spiel?', 'Wie viele Aktionen habe ich noch?']],
    ['@win', ['Wie viele Punkte habe ich?', 'Wie ist mein Punktestand?', 'Wer gewinnt?', 'Wer führt?']],
    ['beer', ['Was ist Bier?']],
    ['coal', ['Wie funktioniert Kohle?']],
    ['sell', ['Wie verkaufe ich?']],
    ['iron', ['Wozu dient Eisen?']],
  ],
  es: [
    ['@do', ['¿Qué hago ahora?', '¿Qué debo hacer?', '¿Qué juego?', '¿Algún consejo?', '¿Cuál es la mejor jugada?', 'Ayúdame']],
    ['@sell', ['¿Puedo vender?', '¿Qué puedo vender?', '¿Puedo vender mi alfarería?', '¿Por qué no puedo vender?']],
    ['@build', ['¿Dónde puedo construir?', '¿Qué puedo construir?', '¿Dónde construir?', '¿Puedo construir algo?']],
    ['@coal', ['¿Dónde está el carbón?', '¿Tengo carbón?', '¿Queda carbón?', '¿Dónde consigo carbón?', '¿Hay carbón?']],
    ['@beer', ['¿Dónde está la cerveza?', '¿Tengo cerveza?', '¿Queda cerveza?', '¿Dónde consigo cerveza?', '¿Hay cerveza?']],
    ['@money', ['¿Cuánto dinero tengo?', '¿Cuánta plata tengo?', '¿Cuáles son mis ingresos?', '¿Puedo pagar?']],
    ['@rounds', ['¿Cuántas rondas quedan?', '¿Cuánto queda?', '¿Cuándo termina la partida?', '¿Cuántas acciones me quedan?', '¿Cuántos turnos quedan?']],
    ['@win', ['¿Cuántos puntos tengo?', '¿Cuál es mi puntuación?', '¿Quién gana?', '¿Quién va ganando?']],
    ['beer', ['¿Qué es la cerveza?']],
    ['coal', ['¿Cómo funciona el carbón?']],
    ['sell', ['¿Cómo vendo?']],
    ['iron', ['¿Para qué sirve el hierro?']],
  ],
};

/* the review's French questions (questions.ts), typed in a hurry */
const QUESTIONS: [string, string][] = [
  ['comment je gagne', 'initiation'],
  ['comment on gagne', 'initiation'],
  ["c'est quoi un canal", 'canal'],
  ['pourquoi je peux pas construire ici', 'build'],
  ['pourquoi je ne peux pas construire', 'build'],
  ['je fais quoi', '@do'],
  ["qu'est-ce que je dois faire", '@do'],
  ['je dois faire quoi maintenant', '@do'],
  ["c'est quoi le revenu", 'income'],
  ['comment gagner des points', 'vp'],
  ['a quoi sert le charbon', 'coal'],
  ['comment vendre', 'sell'],
  ['pourquoi je peux pas vendre', '@sell'],
  ['le fer ca sert a quoi', 'iron'],
  ['comment avoir de la biere', 'beer'],
  ["c'est quoi un marchand", 'merchants'],
  ['quand est-ce que la partie se termine', '@rounds'],
  ['il reste combien de tours', '@rounds'],
  ["comment avoir plus d'argent", 'money'],
  ["j'ai plus d'argent", 'money'],
  ['emprunter ca sert a quoi', 'loan'],
  ['pourquoi wedgwood joue avant moi', '@order'],
  ['qui commence', '@order'],
  ["c'est quoi developper", 'develop'],
  ["c'est quoi une carte lieu", 'cards'],
  ['comment marche le reseau', 'network'],
  ["pourquoi ma mine s'est retournee", 'flip'],
  ["qu'est-ce qui se passe a la fin de l'ere", 'initiation'],
  ["c'est quoi un joker", 'wild'],
  ['je peux construire a birmingham', 'build'],
  ["c'est quoi la paie", 'income'],
  ['ca sert a quoi de retourner une tuile', 'flip'],
  ["c'est quoi prospecter", 'scout'],
  ['comment relier une ville', 'network'],
  ['pourquoi mon revenu est negatif', 'shortfall'],
  ['combien coute une mine', 'coalMine'],
  ['qui gagne', '@win'],
  ['a quoi sert le tapis', 'mat'],
  ["c'est quoi les icones lien", 'links'],
  ['je peux vendre ma poterie', '@sell'],
  ["combien j'ai de points", '@win'],
  ['aide', 'aid'],
  ['je comprends rien', 'overview'],
  ["pourquoi j'ai perdu des points", 'vp'],
  ['ou je peux construire', '@build'],
  ["c'est quoi le niveau de la tuile", 'levels'],
  ['pourquoi la machine a construit une mine', 'coalMine'],
  ['je peux passer mon tour', 'pass'],
];

describe('the review\'s free questions, at the guided table', () => {
  const g = guided();

  for (const lang of ['fr', 'en', 'de', 'es'] as Lang[]) {
    it(`answers every ${lang} phrasing as it was meant`, () => {
      const wrong = PHRASINGS[lang].flatMap(([want, qs]) => qs.map((q) => `${q} → ${answered(q, lang, g)}`).filter((r) => !r.endsWith(`→ ${want}`)).map((r) => `${r} (want ${want})`));
      expect(wrong).toEqual([]);
    });
  }

  it('answers the French questions typed in a hurry', () => {
    const wrong = QUESTIONS.map(([q, want]) => ({ q, want, got: answered(q, 'fr', g) }))
      .filter((r) => r.got !== r.want)
      .map((r) => `${r.q} → ${r.got} (want ${r.want})`);
    expect(wrong).toEqual([]);
  });

  it('reads none of the review\'s misreadings again', () => {
    /* the mines, the sale, "près de", the income */
    expect(answered('Qui mène ?', 'fr', g)).toBe('@win');
    expect(answered('Un conseil ?', 'fr', g)).toBe('@do');
    expect(answered('c’est quoi un ouvrage', 'fr', g)).toBe('works');
    expect(answered('combien d’actions il me reste', 'fr', g)).toBe('@rounds');
    expect(answered('How many actions left?', 'en', g)).toBe('@rounds');
    expect(answered('¿Qué debo hacer?', 'es', g)).toBe('@do');
    expect(answered('Hast du einen Tipp?', 'de', g)).toBe('@do');
  });

  it('tells the end of this short game from the rules when the table is silent', () => {
    /* the assistance off: no figures, but still the canal era alone */
    for (const [lang, q] of [['fr', 'Quand finit la partie ?'], ['fr', 'comment je gagne'], ['en', 'When does the game end?'], ['de', 'Wann endet das Spiel?'], ['es', '¿Cuándo termina la partida?']] as [Lang, string][]) {
      expect(`${q} → ${answered(q, lang, g, false)}`).toBe(`${q} → initiation`);
    }
  });
});
