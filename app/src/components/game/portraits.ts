/** the machines wear their character's portrait; a human seat one of the
 *  house's oil portraits, by seat */
export const portraitFor = (p: { isBot: boolean; persona: string }, index: number): string => (p.isBot ? `/portrait-${p.persona}.webp` : `/portrait-${(index % 4) + 1}.webp`);
