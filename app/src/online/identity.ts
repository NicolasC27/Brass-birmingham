import { randomId } from './table';
import type { Identity } from './table';

/* Who you are at a table: a name you choose, kept for next time, and an
   id per browser tab — so a second tab can sit down as the guest, online
   as well as locally. */

const NAME_KEY = 'brassworks.player.name.v1';
const ID_KEY = 'brassworks.player.id.v1';

export function loadIdentity(): Identity {
  let id = '';
  let name = '';
  try {
    id = sessionStorage.getItem(ID_KEY) ?? '';
    if (!id) {
      id = 'p-' + randomId(10);
      sessionStorage.setItem(ID_KEY, id);
    }
    name = localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    /* private mode: an identity for this page then */
  }
  return { id: id || 'p-' + randomId(10), name };
}

export function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* non-fatal */
  }
}
