/* ------------------------------------------------------------------ */
/* The front page before the line opens: the game in a few lines, the  */
/* waiting list, and the letters the office writes to it.             */
/* ------------------------------------------------------------------ */
const landing = {
  ear: 'Preview',
  eyebrow: 'Soon at the station',
  headline: 'Build the Midlands, canal by canal, rail by rail.',
  lede: 'An economic strategy game for two to four, set in the Black Country from 1770 to 1865. Canals first, then the railway: raise mills and collieries, sell to the merchants, and hold your own against the machines — or your friends.',
  trial: {
    title: 'The trial run',
    text: 'Before the line opens, a few travellers will try the game first. Leave your address and we will write when your seat is ready.',
  },
  form: {
    label: 'Your email address',
    placeholder: 'you@example.com',
    submit: 'Reserve my seat',
    sending: 'Sending…',
    note: 'One letter to confirm, then one when the trial opens. Nothing else, and a way out in every letter.',
    privacy: 'What we do with your address',
  },
  sent: {
    title: 'A letter is on its way',
    text: 'Open it and follow the link to confirm your seat. Nothing there? Look in the spam folder.',
    again: 'Give another address',
  },
  errors: {
    email: 'That does not look like an email address.',
    busy: 'Too many tries from here. Try again in a few minutes.',
    down: 'The office is not answering just now. Try again in a moment.',
  },
  eras: {
    canal: 'The canal era',
    rail: 'The rail era',
  },
  points: [
    { h: 'Two eras', p: 'The canals, then the railway: what was built first gives way, and the network decides everything.' },
    { h: 'Four machines', p: 'Boulton, Wedgwood, Arkwright and Watt each play their own game. Watt always plays to win.' },
    { h: 'Tables online', p: 'Play with others, quick or ranked, and read every game again move by move.' },
  ],
  confirm: {
    eyebrow: 'Waiting list',
    working: 'One moment…',
    title: 'Your seat is reserved',
    text: 'Thank you. We will write to this address as soon as the trial run opens.',
    bad: 'This link no longer works: it may have been used already, or the address was struck after a week without an answer.',
  },
  leave: {
    title: 'Leave the waiting list',
    text: 'Your address will be erased and we will not write again.',
    button: 'Take me off the list',
    done: 'Done: your address is erased.',
    bad: 'This link no longer works: the address has most likely been struck already.',
  },
  back: 'Back to the preview',
  letter: {
    confirmSubject: 'Blackrail — confirm your seat',
    confirmText: 'Hello,\n\nThis address was left on the Blackrail waiting list. Follow this link to confirm your seat:\n\n{link}\n\nIf it was not you, ignore this letter: the address will be erased in a week.\n\n— The Blackrail telegraph office',
    footer: 'You receive this letter because you joined the Blackrail waiting list.\nTo receive no more: {link}',
  },
};

export default landing;
