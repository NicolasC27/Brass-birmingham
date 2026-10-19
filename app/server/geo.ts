import { readFileSync } from 'node:fs';
import { Reader } from 'mmdb-lib';
import type { CountryResponse } from 'mmdb-lib';

/* ------------------------------------------------------------------ */
/* Where an address was left from: the country, and nothing finer.     */
/*                                                                     */
/* The office reads a country database kept on its own disk (DB-IP's   */
/* free "IP to Country Lite", CC BY 4.0, refreshed each month by        */
/* tools/deploy/geo-update.sh): no service is asked, no address leaves */
/* the machine. Only the two-letter code is kept on the waiting list;  */
/* the address itself is forgotten once the letter is answered.        */
/* Without the file, every country is unknown and nothing else changes. */
/* ------------------------------------------------------------------ */

/** a country's ISO 3166 code for an address, '' when unknown */
export type Locate = (ip: string) => string;

export const nowhere: Locate = () => '';

/** the lookup over a database file, or nowhere when there is none */
export function locateFrom(file: string): Locate {
  let reader: Reader<CountryResponse>;
  try {
    reader = new Reader<CountryResponse>(readFileSync(file));
  } catch {
    return nowhere;
  }
  return (ip) => {
    /* an IPv4 address seen through an IPv6 socket */
    const bare = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    try {
      const code = reader.get(bare)?.country?.iso_code ?? '';
      return /^[A-Z]{2}$/.test(code) ? code : '';
    } catch {
      return '';
    }
  };
}

/** the lookup the environment names (BLACKRAIL_GEO_DB), else the file beside the register */
export function locateFromEnv(env: NodeJS.ProcessEnv = process.env): Locate {
  const file = env.BLACKRAIL_GEO_DB?.trim() || 'geo/country.mmdb';
  const locate = locateFrom(file);
  if (locate === nowhere) console.log(`geo: no country database at ${file}; countries stay unknown`);
  return locate;
}
