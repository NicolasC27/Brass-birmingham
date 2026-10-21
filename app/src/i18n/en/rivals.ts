/* ------------------------------------------------------------------ */
/* The rivalries: what a character says to a player it has met before  */
/* — a word as a game at home begins, a postscript to its letters, and */
/* the record on its portrait. Each character keeps its own voice:     */
/* Boulton the salesman, Wedgwood the patient potter, Arkwright who    */
/* counts, Watt who reads every game twice.                            */
/* ------------------------------------------------------------------ */

const rivals = {
  /** the notice's title at the table */
  title: 'A word from {name}',
  /** the portrait's line: the games against this reader */
  record: 'Against you: {games} [games|game|games], {won} won by you.',
  /** the industry the reader leaned on, and the one the character did */
  yours: { coal: 'your coal mines', iron: 'your iron works', cotton: 'your cotton mills', manufacturer: 'your manufactories', pottery: 'your potteries', brewery: 'your breweries' },
  mine: { coal: 'my coal mines', iron: 'my iron works', cotton: 'my cotton mills', manufacturer: 'my manufactories', pottery: 'my potteries', brewery: 'my breweries' },
  boulton: {
    first: '{name}, delighted. Matthew Boulton, of Soho. I sell what the world wants to have; sit down, and we shall see whether that is you.',
    absence: '{name}! We thought you had gone to London. The tea went cold, but the table kept your chair.',
    streakYours: '{n} [n|game|games] running to you, {name}. At Soho they have begun to say your name with respect, and that is no compliment.',
    streakMine: '{n} in a row for me, {name}. I would offer you a share in the business, but you have nothing to bring to it.',
    comeback: 'Last time I led at the canal and you took the whole railway from me. I am watching your rails, {name}, and I have friends on the line.',
    close: '{margin} [margin|point|points] between us last time, {name}. In trade that is called a margin, and I mean to have it back.',
    town: '{town} again? You took it from me last time. I still have customers there, {name}, and they remember me.',
    loans: '{loans} [loans|loan|loans] last time, {name}. My banker sends his regards; he has bought himself a carriage.',
    industry: 'Still {industry}, {name}? Good business. I shall buy the whole output — at my price.',
    own: 'Do you remember {own}, {name}? So does Soho: they still talk of it over the tea.',
    revenge: '{name}, you beat me last time. I told Soho I had let you win. Do not make a liar of me twice.',
    gloat: 'Delighted to see you again, {name}. {theirs} to {vp} last time — not that I am a man to bring it up. Except just now.',
    tally: '{games} [games|game|games] between us, {name}, and {won} of them yours. I keep the accounts: it is my trade.',
    ps: {
      first: 'P.S. Our first game. I have opened an account in your name.',
      streakYours: 'P.S. {n} in a row to you. I begin to wonder who supplies whom.',
      streakMine: 'P.S. {n} in a row to me. Nothing personal: it is commercial.',
      tally: 'P.S. In the ledger: {games} [games|game|games], {won} to you, {lost} to me.',
    },
  },
  wedgwood: {
    first: '{name}. Wedgwood, of Etruria. I throw earthenware for queens; let us see what can be thrown of you.',
    absence: 'There you are, {name}. A glaze left too long in the kiln crazes. You are fortunate: I waited.',
    streakYours: 'You have won {n} [n|time|times] running, {name}. I do not break the china; I keep it for today.',
    streakMine: '{n} [n|time|times] running, {name}, and always for the same reason: haste. Take your time today; I shall take mine.',
    comeback: 'Last time you were behind me at the canal and ahead of me on the railway. I do not care to be overtaken on the line, {name}.',
    close: '{margin} [margin|point|points], {name}. The thickness of a glaze. I have put it back in the kiln.',
    town: '{town} again? You took it from me last time, {name}. I keep a chipped vase from it on the mantelpiece.',
    loans: '{loans} [loans|loan|loans] last time, {name}. Etruria was not built on credit — it was built slowly.',
    industry: 'So it is {industry} again, {name}? A choice. Not yet a style.',
    own: 'You saw what {own} did last time, {name}. I have not changed the recipe.',
    revenge: 'You had the better of me last time, {name}. I did not make a vase of it. But I remember.',
    gloat: 'Good evening, {name}. {theirs} to {vp}, last time. I have kept your place at Etruria — the same one.',
    tally: '{games} [games|game|games] together, {name}, {won} of them yours. I count the pieces fired, and the pieces cracked.',
    ps: {
      first: 'P.S. A first game; I always keep the first piece of a series.',
      streakYours: 'P.S. {n} [n|time|times] running. I have begun to study your manner.',
      streakMine: 'P.S. {n} [n|time|times] running. Patience, {me}. Patience.',
      tally: 'P.S. Between us, {games} [games|game|games]: {won} to you, {lost} to me. I keep the register in ink.',
    },
  },
  arkwright: {
    first: '{name}. Arkwright, Cromford. I spin fast. Keep up if you can.',
    absence: '{name}. A long while. I have doubled my frames since. There it is.',
    streakYours: '{n} in a row to you. I counted. It stops here.',
    streakMine: '{n} in a row to me, {name}. Cotton waits for nobody.',
    comeback: 'Behind at the canal, ahead at the end. Last time. I noted the manoeuvre, {name}. It will not work twice.',
    close: '{margin} [margin|point|points] in it. One more rail and it was mine. Today I have the rail.',
    town: '{town}? Again? You took it from me. I am taking it back.',
    loans: '{loans} [loans|loan|loans] last time, {name}. I counted. I pay cash.',
    industry: 'You and {industry} again? Good. I know where to sell before you do.',
    own: 'Same plan as last time, {name}: {own}, fast, and sell. No need to change it.',
    revenge: 'You beat me last time. Rare. It will not become a habit.',
    gloat: '{theirs} to {vp}, last time. Not luck. Cromford. Again?',
    tally: '{games} [games|game|games]. {won} to you. I count everything, {name}.',
    ps: {
      first: 'P.S. First game. There will be others. I have room in the ledger.',
      streakYours: 'P.S. {n} in a row. I do not like that figure.',
      streakMine: 'P.S. {n} in a row. I like that figure.',
      tally: 'P.S. {games} [games|game|games] between us. {won} to you, {lost} to me. There it is.',
    },
  },
  watt: {
    first: '{name}. James Watt. I play every move in earnest and read every game twice. Let us begin.',
    absence: '{name}. It has been some time. I read our last game through meanwhile. Three times.',
    streakYours: '{n} [n|win|wins] running for you, {name}. I have isolated the cause. It is corrected.',
    streakMine: '{n} in a row for me, {name}. The same error each time. I leave you to find it.',
    comeback: 'Last time: ahead at the close of the canal, beaten on the railway. A steam leak, {name}. Sealed.',
    close: '{vp}–{theirs}, last time. {margin} [margin|point|points]. A tolerance I shall not grant you again.',
    town: '{town}. Again. You got ahead of me there last time, {name}; it is noted in the margin.',
    loans: '{loans} [loans|loan|loans] last time. The return was adequate. The interest, less so.',
    industry: '{name}, you staked everything on {industry} last time. Predictable. I have allowed for it.',
    own: 'No reason to modify an engine that runs, {name}: {own}, as last time.',
    revenge: '{name}. You won last time. I read the game through twice. It will not recur.',
    gloat: '{name}. {theirs}–{vp}, last time. Your coal arrived late. Let us see whether it keeps time today.',
    tally: '{name}. Record: {games} [games|game|games], {won} to you. Figures flatter nobody.',
    ps: {
      first: 'P.S. First game entered. I shall read this one twice too.',
      streakYours: 'P.S. {n} in a row. Unacceptable. I am working on it.',
      streakMine: 'P.S. {n} in a row. Consistent. That is what one expects of an engine.',
      tally: 'P.S. Register: {games} [games|game|games], {won} to you, {lost} to me.',
    },
  },
};

export default rivals;
