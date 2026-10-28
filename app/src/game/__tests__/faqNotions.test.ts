import { describe, expect, it } from 'vitest';
import { askedOf, asksTheRules, consult, fold, mend, slips, sound, tell } from '../faq/consult';
import { FAQ_NOTION, FULL_GAME, NOTION_IDS, SHORT_TOLD } from '../faq/notions';
import { faqBest, faqFor } from '../faq';
import frGame from '@/i18n/fr/game';
import enGame from '@/i18n/en/game';
import esGame from '@/i18n/es/game';
import deGame from '@/i18n/de/game';
import type { NotionId } from '../faq/notions';
import { FR } from '../faq/fr';
import { EN } from '../faq/en';
import { ES } from '../faq/es';
import { DE } from '../faq/de';
import { trIn } from '@/i18n';
import type { Lang } from '@/i18n';
import { intentOf } from '@/components/game/tableAnswers';

/* the guide's case, asked as readers ask: plain questions, spoken ones,
   and the ones typed in a hurry. Every one must land on its notion. */

type Ask = [question: string, notion: NotionId, typo?: 'typo'];

const FR_ASKS: Ask[] = [
  /* the mines */
  ['à quoi sert les mines', 'coalMine'],
  ['a koi serv les minne', 'coalMine', 'typo'],
  ['c’est quoi une mine de charbon ?', 'coalMine'],
  ['combien coûte une mine', 'coalMine'],
  ['ça rapporte quoi une mine', 'coalMine'],
  ['comment on construit une mine ?', 'coalMine'],
  ['les minnes ça sert a quoi', 'coalMine', 'typo'],
  ['a quoi serre les mine', 'coalMine', 'typo'],
  ['une mine de charbont', 'coalMine', 'typo'],
  ['lesmines c’est quoi', 'coalMine', 'typo'],
  ['ma mine vend elle son charbon toute seule ?', 'coalMine'],
  ['c’est quoi une houillère', 'coalMine'],
  /* iron works */
  ['à quoi sert une forge', 'ironWorks'],
  ['c’est quoi la sidérurgie', 'ironWorks'],
  ['combien coute une forje', 'ironWorks', 'typo'],
  ['une aciérie ça rapporte combien', 'ironWorks'],
  ['est-ce que mon fer se vend automatiquement quand je pose la forge ?', 'ironWorks'],
  ['la forrge sert a koi', 'ironWorks', 'typo'],
  /* breweries */
  ['à quoi sert une brasserie', 'brewery'],
  ['combien de barils dans une brasserie', 'brewery'],
  ['une brasserrie c’est quoi', 'brewery', 'typo'],
  ['combien coute une brasseri', 'brewery', 'typo'],
  ['la brasserie donne combien de bière en ère rail', 'brewery'],
  ['c’est quoi les brasseries fermières', 'farmBrewery'],
  ['comment construire sur la ferme', 'farmBrewery'],
  ['la brasserie fermiere du nord', 'farmBrewery'],
  /* the works */
  ['à quoi sert une filature', 'cotton'],
  ['c koi le coton', 'cotton', 'typo'],
  ['combien rapporte une filature de coton', 'cotton'],
  ['une filatture ça fait quoi', 'cotton', 'typo'],
  ['combien coûte une filature', 'cotton'],
  ['c’est quoi une manufacture', 'manufacturer'],
  ['la manufacure sert à quoi', 'manufacturer', 'typo'],
  ['combien de points rapporte une manufacture', 'manufacturer'],
  ['à quoi servent les usines', 'manufacturer'],
  ['à quoi sert la poterie', 'pottery'],
  ['c’est quoi l’ampoule sur les tuiles', 'pottery'],
  ['la potterie ça sert à quoi', 'pottery', 'typo'],
  ['céramique combien ça coûte', 'pottery'],
  /* coal, iron, beer, the market */
  ['c’est quoi le charbon', 'coal'],
  ['d’où vient le charbon', 'coal'],
  ['où trouver du charbon', 'coal'],
  ['pourquoi j’ai pas de charbon', 'coal'],
  ['le charbon d’un adversaire je peux le prendre ?', 'coal'],
  ['le charbont c’est pour quoi', 'coal', 'typo'],
  ['le sharbon', 'coal', 'typo'],
  ['c’est quoi le fer', 'iron'],
  ['où je trouve du fer', 'iron'],
  ['il faut une liaison pour le fer ?', 'iron'],
  ['combien coûte le fer', 'iron'],
  ['le ferr sert a quoi', 'iron', 'typo'],
  ['c koi la biere', 'beer', 'typo'],
  ['c’est quoi la bière', 'beer'],
  ['d’où vient la bierre', 'beer', 'typo'],
  ['où trouver de la bière', 'beer'],
  ['pourquoi je ne peux pas prendre de bière', 'beer'],
  ['la bière du marchand ça sert à quoi', 'beer'],
  ['un baril c’est quoi', 'beer'],
  ['la bièrre adverse', 'beer', 'typo'],
  ['c’est quoi le marché', 'market'],
  ['comment marche le marché ?', 'market'],
  ['pourquoi le prix du charbon monte', 'market'],
  ['combien coûte le charbon au marché', 'market'],
  ['le marcher du fer', 'market', 'typo'],
  ['la bourse', 'market'],
  ['le marché est vide, que se passe-t-il ?', 'market'],
  /* the actions */
  ['comment on construit', 'build'],
  ['pourquoi je peux pas construire', 'build'],
  ['construire ça coûte combien', 'build'],
  ['c’est quoi l’action construire', 'build'],
  ['comment construir', 'build', 'typo'],
  ['pourquoi je peu pas batir', 'build', 'typo'],
  ['comment je pose une tuile', 'build'],
  ['où je peux construire', 'build'],
  ['pourquoi je peux pas construire de mine', 'build'],
  ['c’est quoi mon réseau', 'network'],
  ['comment poser un canal', 'network'],
  ['le reseu c’est quoi', 'network', 'typo'],
  ['pourquoi je ne peux pas poser de liaison', 'network'],
  ['pourquoi je peux pas poser de rail', 'network'],
  ['à quoi sert développer', 'develop'],
  ['comment on développe', 'develop'],
  ['developer ça sert a quoi', 'develop', 'typo'],
  ['combien coûte un développement', 'develop'],
  ['dévlopper une tuile', 'develop', 'typo'],
  ['pourquoi je peux pas développer ma poterie', 'develop'],
  ['comment on vend', 'sell'],
  ['pourquoi je peux pas vendre', 'sell'],
  ['ça rapporte quoi de vendre', 'sell'],
  ['la vente c’est quoi', 'sell'],
  ['je peux vendre plusieurs tuiles en une action ?', 'sell'],
  ['comment vendre du coton', 'sell'],
  ['comment on vandre', 'sell', 'typo'],
  ['combien coute un pret', 'loan'],
  ['c’est quoi un emprunt', 'loan'],
  ['comment on rembourse un prêt', 'loan'],
  ['pourquoi je peux pas emprunter', 'loan'],
  ['un empreint ça marche comment', 'loan', 'typo'],
  ['emprunté de l’argent', 'loan'],
  ['un crédit, ça marche comment ?', 'loan'],
  ['c’est quoi la prospection', 'scout'],
  ['prospecter ça sert a quoi', 'scout'],
  ['pourquoi je peux pas prospecter', 'scout'],
  ['la prospection prend combien de cartes', 'scout'],
  ['c’est quoi un éclaireur', 'scout'],
  ['la prospektion', 'scout', 'typo'],
  ['je peux passer mon tour ?', 'pass'],
  ['passer ça coûte quoi', 'pass'],
  /* the eras */
  ['c’est quoi l’ère canal', 'canal'],
  ['combien coûte un canal', 'canal'],
  ['les canaux', 'canal'],
  ['un cannal ça coute combien', 'canal', 'typo'],
  ['c’est quoi le rail', 'rail'],
  ['combien coûte un rail', 'rail'],
  ['double rail comment ça marche', 'rail'],
  ['le chemin de fer', 'rail'],
  ['les rails ça coute combien', 'rail'],
  ['c’est quoi une liaison', 'links'],
  ['combien rapporte une liaison', 'links'],
  ['une liason c’est quoi', 'links', 'typo'],
  ['une liaison marque combien de points', 'links'],
  ['combien de manches', 'eras'],
  ['c’est quoi une ère', 'eras'],
  ['combien de manches par ère', 'eras'],
  ['combien de mamches', 'eras', 'typo'],
  ['que se passe-t-il à la première manche', 'firstRound'],
  ['combien d’actions au premier tour', 'firstRound'],
  ['que se passe-t-il entre les deux ères ?', 'eraEnd'],
  ['la fin de l’ère canal', 'eraEnd'],
  ['les tuiles de niveau 1 disparaissent ?', 'eraEnd'],
  ['comment on compte les points', 'scoring'],
  ['le décompte', 'scoring'],
  ['le decomte c’est quand', 'scoring', 'typo'],
  ['comment marquer des points', 'scoring'],
  ['en cas d’égalité qui gagne', 'ties'],
  ['égaliter', 'ties', 'typo'],
  ['ex aequo', 'ties'],
  ['quand finit la partie', 'gameEnd'],
  ['qui gagne à la fin', 'gameEnd'],
  ['comment on gagne', 'gameEnd'],
  ['le vainceur', 'gameEnd', 'typo'],
  ['c’est quoi la partie d’initiation', 'initiation'],
  ['une partie courte', 'initiation'],
  /* money */
  ['à quoi servent les marchands', 'merchants'],
  ['le bonus marchand', 'merchants'],
  ['c’est quoi le bonus de gloucester', 'merchants'],
  ['les marchants', 'merchants', 'typo'],
  ['ça donne quoi shrewsbury', 'merchants'],
  ['c’est quoi le revenu', 'income'],
  ['comment augmenter mon revenu', 'income'],
  ['la paie c’est quand', 'income'],
  ['mon revnu', 'income', 'typo'],
  ['la piste de revenu', 'income'],
  ['que se passe-t-il si je n’ai pas assez d’argent pour payer', 'shortfall'],
  ['la faillitte', 'shortfall', 'typo'],
  ['je suis ruiné', 'shortfall'],
  ['combien d’argent au début', 'money'],
  ['à quoi sert l’argent', 'money'],
  ['mon argant', 'money', 'typo'],
  ['qui joue en premier', 'turnOrder'],
  ['l’ordre du tour c’est quoi', 'turnOrder'],
  ['comment est décidé l’ordre de jeu', 'turnOrder'],
  ['l’ordre du tuor', 'turnOrder', 'typo'],
  ['combien d’actions par tour', 'actions'],
  ['deux actions ?', 'actions'],
  /* the tiles */
  ['quand est-ce que ma forge se retourne', 'flip'],
  ['c’est quoi une tuile retournée', 'flip'],
  ['comment retourner une tuile', 'flip'],
  ['flipper une tuile', 'flip'],
  ['retournner une tuile', 'flip', 'typo'],
  ['c’est quoi les niveaux', 'levels'],
  ['le niveau des tuiles', 'levels'],
  ['surconstruire c’est quoi', 'overbuild'],
  ['sur construire', 'overbuild', 'typo'],
  ['la sur-construction', 'overbuild'],
  ['surconstuire une mine', 'overbuild', 'typo'],
  ['construire par dessus une tuile adverse', 'overbuild'],
  ['c’est quoi le tapis', 'mat'],
  ['combien de tuiles sur mon tapis', 'mat'],
  ['le tapi du joueur', 'mat', 'typo'],
  ['combien de villes', 'towns'],
  ['deux tuiles dans la même ville ?', 'towns'],
  ['un emplacement c’est quoi', 'towns'],
  ['c’est quoi les pv', 'vp'],
  ['à quoi servent les points de victoire', 'vp'],
  ['les poins de victoire', 'vp', 'typo'],
  /* the cards */
  ['c’est quoi une carte lieu', 'cards'],
  ['quelle carte construit quoi', 'cards'],
  ['une carte industrie', 'cards'],
  ['c’est quoi un joker', 'wild'],
  ['le joker lieu', 'wild'],
  ['un jocker', 'wild', 'typo'],
  ['combien de cartes en main', 'hand'],
  ['la pioche est vide', 'hand'],
  ['piocher des cartes', 'hand'],
  ['la pioche vid', 'hand', 'typo'],
  ['à combien de joueurs on joue', 'players'],
  ['ça change quoi à deux joueurs', 'players'],
  /* the table */
  ['comment annuler un coup', 'undo'],
  ['je me suis trompé', 'undo'],
  ['anuler mon coup', 'undo', 'typo'],
  ['pourquoi je peux pas annuler', 'undo'],
  ['comment valider mon coup', 'confirm'],
  ['comment préparer un coup à l’avance', 'prepare'],
  ['c’est quoi le registre', 'ledger'],
  ['l’historique des coups', 'ledger'],
  ['le regsitre', 'ledger', 'typo'],
  ['à quoi sert le carnet', 'notebook'],
  ['prendre des notes', 'notebook'],
  ['comment ouvrir la bourse', 'marketPanel'],
  ['à quoi sert la minicarte', 'minimap'],
  ['la mini carte', 'minimap'],
  ['les raccourcis clavier', 'keys'],
  ['quelles sont les touches', 'keys'],
  ['les racourcis', 'keys', 'typo'],
  ['où sont les réglages', 'settings'],
  ['changer la langue', 'settings'],
  ['c’est quoi l’aide au placement', 'aid'],
  ['le mode débutant', 'aid'],
  ['qui est mr watt', 'machines'],
  ['les bots jouent comment', 'machines'],
  ['c’est quoi les machines', 'machines'],
  ['où sont les règles', 'rules'],
  /* spoken French, typed in a hurry */
  ['c quoi une mine', 'coalMine'],
  ['jcomprend pas les mines', 'coalMine', 'typo'],
  ['kes ke la biere', 'beer', 'typo'],
  ['pourquoi jarrive pas a vendre ma filature', 'sell', 'typo'],
  ['pk je peu pa emprunter', 'loan', 'typo'],
  ['comment gagner des points', 'vp'],
  ['ma tuile est grisée pourquoi', 'build'],
  ['pourquoi mes canaux ont disparu', 'eraEnd'],
  ['les jokers sa sert a quoi', 'wild', 'typo'],
  ['c est koi une manufacture', 'manufacturer', 'typo'],
  ['la filature ca rapporte koi', 'cotton', 'typo'],
  ['comment on pose un rail', 'network'],
  ['ya combien de villes', 'towns'],
  ['c’est quoi le but du jeu', 'overview'],
  ['je comprend rien', 'overview', 'typo'],
  ['a quoi sert le bouton plume', 'notebook'],
  ['qui commence', 'firstRound'],
  ['la char bon', 'coal', 'typo'],
];

const EN_ASKS: Ask[] = [
  ['what are mines for', 'coalMine'],
  ['what do coal mines do?', 'coalMine'],
  ['how much does a mine cost', 'coalMine'],
  ['wat is a colliery', 'coalMine', 'typo'],
  ['what is an iron works', 'ironWorks'],
  ['what does a brewery do', 'brewery'],
  ['what is a cotton mill', 'cotton'],
  ['how much is a manufactory worth', 'manufacturer'],
  ['what is the lightbulb on potteries', 'pottery'],
  ['where does coal come from', 'coal'],
  ['where do I get iron', 'iron'],
  ['whats beer for', 'beer'],
  ['what is teh beer for', 'beer', 'typo'],
  ['how does the market work', 'market'],
  ['how do I build', 'build'],
  ['why can’t I build here', 'build'],
  ['why cant i buidl', 'build', 'typo'],
  ['how do I sell', 'sell'],
  ['why can’t I sell my mill', 'sell'],
  ['how much does a loan cost', 'loan'],
  ['can I repay a lone', 'loan', 'typo'],
  ['what does develop do', 'develop'],
  ['what is scouting', 'scout'],
  ['how much is a canal', 'canal'],
  ['what is a double rail', 'rail'],
  ['how many rounds are there', 'eras'],
  ['what happens at the end of the canal era', 'eraEnd'],
  ['who wins a tie', 'ties'],
  ['how does turn order work', 'turnOrder'],
  ['what are merchants', 'merchants'],
  ['what is income', 'income'],
  ['what if I go bankrupt', 'shortfall'],
  ['what is overbuilding', 'overbuild'],
  ['what are wild cards', 'wild'],
  ['how do I undo a move', 'undo'],
  ['what is the ledger', 'ledger'],
  ['keyboard shortcuts', 'keys'],
  ['who is mr watt', 'machines'],
  ['can i build on someone elses tile', 'overbuild'],
  ['how do i play', 'overview'],
  ['breweyr', 'brewery', 'typo'],
  ['mnie', 'coalMine', 'typo'],
];

const ES_ASKS: Ask[] = [
  ['para qué sirven las minas', 'coalMine'],
  ['cuanto cuesta una mina', 'coalMine'],
  ['que es una fundicion', 'ironWorks'],
  ['para que sirve la cerveceria', 'brewery'],
  ['que es la alfareria', 'pottery'],
  ['de donde sale el carbon', 'coal'],
  ['que es la serveza', 'beer', 'typo'],
  ['como funciona el mercado', 'market'],
  ['como construyo', 'build'],
  ['por qué no puedo construir', 'build'],
  ['como vendo', 'sell'],
  ['cuanto cuesta un prestamo', 'loan'],
  ['que es explorar', 'scout'],
  ['cuantas rondas hay', 'eras'],
  ['quien gana si hay empate', 'ties'],
  ['que son los comodines', 'wild'],
  ['como deshago una jugada', 'undo'],
  ['que son los mercaderes', 'merchants'],
  ['quien empieza', 'turnOrder'],
  ['como se juega', 'overview'],
  ['ferocarril', 'rail', 'typo'],
  ['cervesa', 'beer', 'typo'],
];

const DE_ASKS: Ask[] = [
  ['wozu sind minen gut', 'coalMine'],
  ['was kostet eine kohlemine', 'coalMine'],
  ['was ist eine eisenhütte', 'ironWorks'],
  ['was macht eine brauerei', 'brewery'],
  ['woher kommt die kohle', 'coal'],
  ['was ist bir', 'beer', 'typo'],
  ['wie funktioniert der markt', 'market'],
  ['wie baue ich', 'build'],
  ['warum kann ich nicht bauen', 'build'],
  ['wie verkaufe ich', 'sell'],
  ['was kostet ein kredit', 'loan'],
  ['was ist erkunden', 'scout'],
  ['wie viele runden gibt es', 'eras'],
  ['was sind die joker', 'wild'],
  ['wie nehme ich einen zug zurück', 'undo'],
  ['was ist überbauen', 'overbuild'],
  ['was sind händler', 'merchants'],
  ['wer ist mr watt', 'machines'],
  ['wer fängt an', 'turnOrder'],
  ['wie spielt man', 'overview'],
  ['brauerai', 'brewery', 'typo'],
  ['kohlle', 'coal', 'typo'],
];

const ALL: [Lang, Ask[]][] = [['fr', FR_ASKS], ['en', EN_ASKS], ['es', ES_ASKS], ['de', DE_ASKS]];

describe('the guide’s case, asked as readers ask', () => {
  it('holds enough questions, and enough of them misspelt', () => {
    const all = ALL.flatMap(([, a]) => a);
    expect(all.length).toBeGreaterThanOrEqual(150);
    expect(all.filter((a) => a[2] === 'typo').length).toBeGreaterThanOrEqual(40);
  });

  for (const [lang, asks] of ALL) {
    it(`lands every ${lang} question on its notion`, () => {
      const wrong = asks
        .map(([q, want]) => ({ q, want, got: consult(q, lang).notion }))
        .filter((r) => r.got !== r.want)
        .map((r) => `${r.q} → ${r.got ?? 'nothing'} (want ${r.want})`);
      expect(wrong).toEqual([]);
    });
  }
});

describe('the way a question is put', () => {
  it('tells why not, how much, what for and how apart', () => {
    expect(askedOf('pourquoi je peux pas construire', 'fr')).toBe('whyNot');
    expect(askedOf('combien coute un pret', 'fr')).toBe('cost');
    expect(askedOf('ça rapporte quoi une filature', 'fr')).toBe('gain');
    expect(askedOf('comment on vend', 'fr')).toBe('how');
    expect(askedOf('à quoi sert les mines', 'fr')).toBe('what');
    expect(askedOf('pk jpeux pas vendre', 'fr')).toBe('whyNot');
  });

  it('answers with the telling the question asked for', () => {
    expect(consult('combien coute un pret', 'fr').answer).toBe(tell('loan', 'fr', 'cost'));
    expect(consult('pourquoi je peux pas construire', 'fr').answer).toBe(tell('build', 'fr', 'whyNot'));
    expect(consult('comment on vend', 'fr').answer).toBe(tell('sell', 'fr', 'how'));
    expect(consult('à quoi sert les mines', 'fr').answer).toBe(tell('coalMine', 'fr', 'what'));
    /* a notion with no telling of its own for the way it was asked keeps
       its plain one */
    expect(tell('eras', 'fr', 'whyNot')).toBe(tell('eras', 'fr'));
  });
});

describe('when nothing is close', () => {
  it('offers the nearest notions by name, never a shrug', () => {
    for (const q of ['zzzz', 'bonjour', 'qwerty uiop']) {
      const r = consult(q, 'fr');
      expect(r.kind).toBe('near');
      expect(r.near.length).toBeGreaterThanOrEqual(2);
      expect(r.near.length).toBeLessThanOrEqual(3);
      expect(r.answer).toBe(FR.near);
    }
  });

  it('offers the notions a stray word is closest to', () => {
    const r = consult('brassaggio', 'fr');
    expect(r.kind).toBe('near');
    expect(r.near.map((n) => n.id)).toContain('brewery');
  });
});

describe('the reading of a word', () => {
  it('folds accents, case and apostrophes', () => {
    expect(fold('C’est QUOI la Bière ?')).toBe('c est quoi la biere');
    expect(fold('Straße')).toBe('strasse');
  });

  it('hears French spelt by ear', () => {
    expect(sound('koi')).toBe(sound('quoi'));
    expect(sound('bierre')).toBe(sound('biere'));
    expect(sound('charbont')).toBe(sound('charbon'));
    expect(sound('minne')).toBe(sound('mine'));
    expect(sound('serre')).toBe(sound('sert'));
  });

  it('counts a swap of two letters as one slip', () => {
    expect(slips('regsitre', 'registre', 2)).toBe(1);
    expect(slips('mine', 'mien', 1)).toBe(1);
    expect(slips('abcdef', 'uvwxyz', 1)).toBeGreaterThan(1);
  });

  it('mends a question into words the table knows', () => {
    expect(mend('combien j’ai d’argant', 'fr')).toContain('argent');
    expect(mend('char bon', 'fr')).toContain('charbon');
  });
});

describe('the case in four tongues', () => {
  const tongues = { fr: FR, en: EN, es: ES, de: DE };
  it('sets every notion in every tongue, with words and a plain telling', () => {
    for (const [lang, t] of Object.entries(tongues)) {
      for (const id of NOTION_IDS) {
        const n = t.notions[id];
        expect(`${lang}:${id}:${n.words.length > 0}`).toBe(`${lang}:${id}:true`);
        expect(`${lang}:${id}:${n.what.length > 60}`).toBe(`${lang}:${id}:true`);
        expect(`${lang}:${id}:${n.topic.length > 0}`).toBe(`${lang}:${id}:true`);
      }
    }
  });

  it('gives each tongue the same tellings', () => {
    for (const t of [EN, ES, DE]) {
      for (const id of NOTION_IDS) {
        for (const k of ['how', 'cost', 'gain', 'whyNot'] as const) expect(`${id}.${k}:${!!t.notions[id][k]}`).toBe(`${id}.${k}:${!!FR.notions[id][k]}`);
      }
    }
  });

  it('answers in the reader’s own tongue', () => {
    expect(consult('que es una mina', 'es').answer).toBe(ES.notions.coalMine.what);
    expect(consult('was ist eine mine', 'de').answer).toBe(DE.notions.coalMine.what);
    expect(consult('what is a mine', 'en').answer).toBe(EN.notions.coalMine.what);
  });

  it('files every written answer under a notion', () => {
    expect(faqFor('fr').filter((e) => !FAQ_NOTION[e.id]).map((e) => e.id)).toEqual([]);
  });

  it('gives the written answer in the reader’s own tongue', () => {
    const asks: ['es' | 'de', string, string][] = [
      ['es', '¿mi fundición vende el hierro automáticamente?', 'ironSells'],
      ['es', '¿dónde encuentro hierro?', 'ironWhere'],
      ['es', '¿el hierro necesita conexión?', 'ironConnection'],
      ['es', '¿qué pasa si el mercado está vacío de carbón?', 'marketEmpty'],
      ['es', '¿cuántas cartas tiene el mazo?', 'deckSize'],
      ['es', '¿puedo explorar con un comodín en la mano?', 'scoutWithWild'],
      ['es', '¿cuántas rondas dura una era?', 'roundsPerEra'],
      ['es', '¿con cuánto dinero empiezo?', 'startingPurse'],
      ['es', '¿qué es la ruta burton walsall?', 'canalOnlyRoute'],
      ['es', '¿puedo usar la mina de un rival?', 'rivalMineLinks'],
      ['de', 'verkauft meine eisenhütte das eisen automatisch?', 'ironSells'],
      ['de', 'verkauft meine mine die kohle automatisch?', 'coalSells'],
      ['de', 'woher bekomme ich eisen?', 'ironWhere'],
      ['de', 'braucht eisen einen anschluss?', 'ironConnection'],
      ['de', 'was passiert, wenn der kohlemarkt leer ist?', 'marketEmpty'],
      ['de', 'ein plättchen pro ort in der kanalzeit?', 'oneTilePerPlace'],
      ['de', 'kann ich erkunden mit joker auf der hand?', 'scoutWithWild'],
      ['de', 'wie viele runden hat eine epoche?', 'roundsPerEra'],
      ['de', 'wie viel geld habe ich am anfang?', 'startingPurse'],
      ['de', 'kann ich die mine anderer spieler nutzen?', 'rivalMineLinks'],
    ];
    for (const [lang, q, id] of asks) {
      const own = faqFor(lang).find((e) => e.id === id)!;
      const r = consult(q, lang);
      expect(`${q} → ${r.kind}:${r.answer === own.answer ? id : r.notion}`).toBe(`${q} → entry:${id}`);
      /* the reader's tongue, never the French or the English standing in */
      expect(r.answer).not.toBe(faqFor('fr').find((e) => e.id === id)!.answer);
      expect(r.answer).not.toBe(faqFor('en').find((e) => e.id === id)!.answer);
    }
  });

  it('answers in detail in every tongue where it does in French', () => {
    /* a written answer's topic, asked as it is titled, is the same question
       in the four tongues: where the French reader gets the written answer,
       the Spanish and the German readers get theirs */
    const fr = faqFor('fr');
    const detailed = fr.filter((e) => consult(e.topic, 'fr').answer === e.answer).map((e) => e.id);
    expect(detailed.length).toBeGreaterThanOrEqual(40);
    for (const lang of ['es', 'de'] as const) {
      const entries = new Map(faqFor(lang).map((e) => [e.id, e]));
      const flat = detailed.filter((id) => consult(entries.get(id)!.topic, lang).answer !== entries.get(id)!.answer);
      expect(`${lang}: ${flat.join(', ')}`).toBe(`${lang}: `);
    }
  });

  it('tells why a flip did not raise the pay, in every tongue', () => {
    const asks: [Lang, string][] = [
      ['fr', 'pourquoi mon revenu n’a pas augmenté après avoir retourné une tuile ?'],
      ['fr', 'j’ai retourné une tuile et mon revenu n’a pas monté'],
      ['en', 'why didn’t my income go up after flipping a tile?'],
      ['en', 'I flipped a tile but my income did not rise'],
      ['es', '¿por qué mis ingresos no subieron al voltear una loseta?'],
      ['de', 'warum ist mein einkommen nach dem umdrehen nicht gestiegen?'],
    ];
    for (const [lang, q] of asks) {
      const own = faqFor(lang).find((e) => e.id === 'flipNoRaise')!;
      expect(`${q} → ${consult(q, lang).answer === own.answer ? 'flipNoRaise' : consult(q, lang).notion}`).toBe(`${q} → flipNoRaise`);
    }
    /* asked why not, the notion itself says it too */
    for (const t of [FR, EN, ES, DE]) expect(t.notions.income.whyNot).toMatch(/10.*31.*61/);
  });

  it('never advises a move nor projects a score', () => {
    /* the guide explains; it does not play for the reader */
    const advice = /\b(vous devriez|je vous conseille|il vaut mieux|you should|we recommend|deberías|te recomiendo|sie sollten|ich empfehle)\b/i;
    for (const t of [FR, EN, ES, DE]) {
      for (const id of NOTION_IDS) {
        const n = t.notions[id];
        for (const s of [n.what, n.how, n.cost, n.gain, n.whyNot]) if (s) expect(advice.test(s) ? `${id}: ${s}` : '').toBe('');
      }
    }
  });
});

describe('a short game', () => {
  it('tells its end, its eras and its scoring with the initiation', () => {
    const asks: [Lang, string][] = [
      ['fr', 'quand finit la partie'], ['fr', 'comment je gagne'], ['fr', 'c’est quoi la fin d’ère'], ['fr', 'est-ce que les tuiles de niveau 1 disparaissent'],
      ['fr', 'comment marche le décompte'], ['fr', 'que se passe-t-il à la fin de l’ère'], ['en', 'when does the game end'], ['en', 'how do i win'],
      ['en', 'what happens at the end of the era'], ['de', 'wann endet das spiel'], ['de', 'wie gewinnt man'], ['es', 'cuando termina la partida'], ['es', 'como se gana'],
    ];
    for (const [lang, q] of asks) {
      const full = consult(q, lang);
      const short = consult(q, lang, [], true);
      expect(`${q} → ${short.notion}`).toBe(`${q} → initiation`);
      expect(short.answer).toBe(tell('initiation', lang, short.asked));
      /* the full game keeps the rail era's telling */
      expect(full.notion).not.toBe('initiation');
    }
  });

  it('gives way to the initiation where a written answer speaks of the rail era', () => {
    /* money counts at a short game's close, not for nothing */
    expect(consult('l’argent rapporte des points ?', 'fr').kind).toBe('entry');
    expect(consult('l’argent rapporte des points ?', 'fr', [], true).notion).toBe('initiation');
    /* a tie is settled the same way, but the game does not end on the rail */
    expect(consult('égalité vainqueur', 'fr').answer).toMatch(/rail/);
    expect(consult('égalité vainqueur', 'fr', [], true)).toMatchObject({ notion: 'ties', answer: tell('ties', 'fr') });
    /* what holds for both lengths stays written */
    expect(consult('combien de manches dure une ère', 'fr', [], true)).toMatchObject({ kind: 'entry', notion: 'eras' });
  });

  it('tells the initiation whole: its rounds, its count and its close', () => {
    for (const t of [FR, EN, ES, DE]) {
      const n = t.notions.initiation;
      expect(n.what).toMatch(/10.*9.*8/);
      expect(n.what).toMatch(/15/);
      expect(n.how).toMatch(/15/);
      for (const s of [n.what, n.how]) expect(s).not.toMatch(/rail|ferrocarril|Eisenbahn/i);
    }
    /* every notion told otherwise, and every written answer, is the case's own */
    for (const id of [...Object.values(SHORT_TOLD), ...Object.values(FULL_GAME)]) expect(NOTION_IDS).toContain(id);
    for (const id of Object.keys(FULL_GAME)) expect(FAQ_NOTION[id]).toBeDefined();
  });
});

/* the guided game answers some questions from the table as it stands:
   the lane's and the question tool's own reading, over the same phrases */
const TABLE_WORDS: Record<Lang, Record<string, string>> = { fr: frGame.guide.ask.words, en: enGame.guide.ask.words, es: esGame.guide.ask.words, de: deGame.guide.ask.words };

function tableIntent(q: string, lang: Lang): string | null {
  const best = intentOf(q, (k, v) => trIn(lang, k, v), lang);
  const written = faqBest(q, faqFor(lang));
  return best && (!written || best.score >= written.score) ? best.id : null;
}

describe('the table’s questions and the rules’ ones', () => {
  it('leaves the table the questions about the seat', () => {
    const seat: [Lang, string, string][] = [
      ['fr', 'j’ai combien d’argent', 'money'], ['fr', 'il me reste combien de manches', 'rounds'], ['fr', 'combien de points j’ai', 'win'],
      ['fr', 'est-ce que je peux vendre quelque chose', 'sell'], ['fr', 'où est le charbon ?', 'coal'], ['fr', 'il reste de la bière ?', 'beer'],
      ['fr', 'qui gagne ?', 'win'], ['fr', 'j’ai de la bière ?', 'beer'], ['fr', 'que faire maintenant', 'do'], ['fr', 'où je peux construire', 'build'],
      ['fr', 'qu’est-ce que je peux vendre', 'sell'], ['fr', 'pourquoi je peux pas vendre', 'sell'], ['fr', 'mon revenu actuel', 'money'],
      ['en', 'how much money do i have', 'money'], ['en', 'do i have coal', 'coal'], ['en', 'any beer left', 'beer'], ['en', 'who is winning', 'win'],
      ['en', 'what now', 'do'], ['en', 'where can i build', 'build'], ['en', 'how many rounds left', 'rounds'],
      ['es', 'cuanto dinero tengo', 'money'], ['es', 'quien gana', 'win'], ['es', 'queda cerveza', 'beer'], ['es', 'donde esta el carbon', 'coal'],
      ['de', 'wie viel geld habe ich', 'money'], ['de', 'wer gewinnt', 'win'], ['de', 'ist noch bier', 'beer'], ['de', 'wo ist die kohle', 'coal'],
    ];
    for (const [lang, q, id] of seat) expect(`${q} → ${tableIntent(q, lang)}`).toBe(`${q} → ${id}`);
    /* and every phrase the table is found by, asked as it is written */
    for (const lang of ['fr', 'en', 'es', 'de'] as Lang[]) {
      for (const list of Object.values(TABLE_WORDS[lang])) for (const phrase of list.split(',')) expect(`${phrase}: ${asksTheRules(phrase, lang, phrase)}`).toBe(`${phrase}: false`);
    }
  });

  it('gives the rules back what the table’s short phrases would catch', () => {
    const rules: [Lang, string][] = [
      ['fr', 'c koi la biere'], ['fr', 'c’est quoi la bière'], ['fr', 'qu’est-ce que la bière'], ['fr', 'c’est quoi une mine de charbon ?'],
      ['fr', 'une mine de charbont'], ['fr', 'le sharbon'], ['fr', 'combien de points rapporte une manufacture'], ['fr', 'combien coûte le charbon au marché'],
      ['fr', 'une liaison marque combien de points'], ['fr', 'en cas d’égalité qui gagne'], ['fr', 'combien d’actions au premier tour'],
      ['fr', 'le charbon d’un adversaire je peux le prendre ?'], ['fr', 'la bière du marchand ça sert à quoi'],
      ['en', 'what is beer'], ['en', 'what does coal do'], ['es', 'que es la cerveza'], ['es', 'para que sirve el carbon'],
      ['de', 'was ist bier'], ['de', 'wozu dient kohle'],
    ];
    for (const [lang, q] of rules) expect(`${q} → ${tableIntent(q, lang)}`).toBe(`${q} → null`);
  });

  it('keeps the table’s question that names what its answer reaches', () => {
    /* the sale answers for the works, the build for any tile */
    expect(asksTheRules('je peux vendre ma poterie', 'fr', 'je peux vendre')).toBe(true);
    expect(asksTheRules('je peux vendre ma poterie', 'fr', 'je peux vendre', ['pottery'])).toBe(false);
    expect(asksTheRules('can i sell my pottery', 'en', 'can i sell', ['pottery'])).toBe(false);
    /* a notion out of reach is still the rules' */
    expect(asksTheRules('je peux vendre du charbon', 'fr', 'je peux vendre', ['pottery'])).toBe(true);
  });

  it('keeps a question put in one word of the matter when it asks where', () => {
    expect(asksTheRules('où construire ?', 'fr', 'ou construire')).toBe(false);
    expect(asksTheRules('wo bauen?', 'de', 'wo bauen')).toBe(false);
    expect(asksTheRules('comment construire', 'fr', 'ou construire')).toBe(true);
    expect(asksTheRules('le charbon', 'fr', 'j ai du charbon')).toBe(true);
  });

  it('leaves the table a word the rules do not know', () => {
    expect(asksTheRules('un conseil ?', 'fr', 'un conseil')).toBe(false);
    expect(asksTheRules('hast du einen tipp?', 'de', 'einen tipp')).toBe(false);
    /* unless it asks what the word means */
    expect(asksTheRules('c est quoi un conseil', 'fr', 'un conseil')).toBe(true);
  });
});
