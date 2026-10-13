import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { connect } from 'node:net';

/* Put a copy from the drawer back in the register's place:
     npm run office:restore -- backups/brassworks-20260923T090000.db
   It refuses while an office still answers on PORT (default 8787): the
   register is swapped only with the house closed. The register it
   replaces is kept beside it as <file>.before-restore-<time>. */

const source = process.argv[2];
const file = process.env.BLACKRAIL_DB ?? 'brassworks.db';
const port = Number(process.env.PORT ?? 8787);
if (!source || !existsSync(source)) {
  console.error('usage: npm run office:restore -- <backup file>');
  process.exit(2);
}

const open = await new Promise((done) => {
  const s = connect({ port, host: '127.0.0.1' });
  s.once('connect', () => (s.destroy(), done(true)));
  s.once('error', () => done(false));
});
if (open) {
  console.error(`restore refused: an office is answering on port ${port}. Close it first.`);
  process.exit(1);
}

const copy = new DatabaseSync(source, { readOnly: true });
const check = copy.prepare('pragma integrity_check').get();
const games = copy.prepare('select count(*) as n from games').get().n;
copy.close();
if (Object.values(check)[0] !== 'ok') {
  console.error(`restore refused: ${source} fails its integrity check`);
  process.exit(1);
}

if (existsSync(file)) {
  const aside = `${file}.before-restore-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const db = new DatabaseSync(file);
  db.prepare('vacuum into ?').run(aside);
  db.close();
  console.log(`the register as it was: ${aside}`);
}
for (const tail of ['-wal', '-shm']) rmSync(file + tail, { force: true });
copyFileSync(source, file);
console.log(`restored ${source} into ${file} (${games} games)`);
