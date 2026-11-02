#!/usr/bin/env node
/**
 * Renames what `expo export` wrote to what the Worker can serve (wrangler.toml,
 * public/_redirects). Workers Static Assets can't serve a file with brackets in
 * its name: the URL redirects to itself forever.
 */
import { renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

renameSync(join(DIST, '+not-found.html'), join(DIST, '404.html'));
renameSync(join(DIST, 'room', '[code].html'), join(DIST, 'room', 'index.html'));
// Their real pages are prerendered, one per item and category (none when the
// catalog is empty, as in e2e builds).
rmSync(join(DIST, 'item', '[id].html'), { force: true });
rmSync(join(DIST, 'categorie', '[key].html'), { force: true });
