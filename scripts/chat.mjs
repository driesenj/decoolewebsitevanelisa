// Manage the live Messenger data in Firestore (messages in "guestbook", the "wie bezocht mijn profiel" list in "visitors"):
//   npm run chat                       list everything with ids (public read, nothing needed)
//   npm run chat -- delete <id> [id..] delete those messages/visitors
// The site's rules forbid deleting from the browser (on purpose), so deleting goes through a service account of the
// Firebase project: Firebase console -> Projectinstellingen -> Serviceaccounts -> "Nieuwe persoonlijke sleutel genereren",
// save the file as firebase/service-account.json (git-ignored) or point FIREBASE_SERVICE_ACCOUNT in .env to it.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { ROOT, exists } from './lib.mjs';

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { }
const cfgSrc = await fs.readFile(path.join(ROOT, 'js', 'firebase-config.js'), 'utf8');
const PROJECT = cfgSrc.match(/projectId:\s*"([^"]+)"/)?.[1];
const API_KEY = cfgSrc.match(/apiKey:\s*"([^"]+)"/)?.[1];
if (!PROJECT) { console.error('Geen projectId gevonden in js/firebase-config.js'); process.exit(1); }
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const COLLECTIONS = { guestbook: 'bericht', visitors: 'bezoeker' };

// ---- read (allowed for everyone by the rules) ------------------------------------------------------
const field = (v) => v?.stringValue ?? v?.timestampValue ?? v?.integerValue ?? null;
async function list(col) {
  const out = [];
  for (let token = ''; ;) {
    const r = await fetch(`${DOCS}/${col}?pageSize=300&key=${API_KEY}${token ? '&pageToken=' + token : ''}`);
    const j = await r.json();
    if (!r.ok) throw new Error(`${col}: ${j.error?.message || r.status}`);
    for (const d of j.documents || []) out.push({ id: d.name.split('/').pop(), col, ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, field(v)])) });
    if (!(token = j.nextPageToken)) break;
  }
  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
async function listAll() {
  const all = [];
  for (const col of Object.keys(COLLECTIONS)) all.push(...await list(col));
  return all;
}
const line = (d) => `${d.id}  ${String(d.createdAt || '').slice(0, 16).replace('T', ' ')}  ${d.room ? `[${d.room}] ` : ''}${d.name}${d.message ? ': ' + d.message : ''}`;

// ---- write (service account -> OAuth token -> Firestore REST) ---------------------------------------------
async function accessToken() {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT || path.join(ROOT, 'firebase', 'service-account.json');
  if (!await exists(file)) {
    console.error(`Geen service-account gevonden (${file}).`);
    console.error('Maak er een in de Firebase console: Projectinstellingen -> Serviceaccounts -> "Nieuwe persoonlijke sleutel genereren",');
    console.error('bewaar het bestand als firebase/service-account.json (staat in .gitignore) en probeer opnieuw.');
    process.exit(1);
  }
  const sa = JSON.parse(await fs.readFile(file, 'utf8'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`Geen toegangstoken: ${j.error_description || j.error || r.status}`);
  return j.access_token;
}
async function remove(ids) {
  const all = await listAll();
  const byId = new Map(all.map(d => [d.id, d]));
  const targets = ids.map(id => byId.get(id) || null);
  ids.forEach((id, i) => { if (!targets[i]) console.error(`  ? ${id}: bestaat niet (meer)`); });
  const todo = targets.filter(Boolean);
  if (!todo.length) return;
  const token = await accessToken();
  for (const d of todo) {
    const r = await fetch(`${DOCS}/${d.col}/${d.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) { const j = await r.json().catch(() => ({})); console.error(`  ! ${d.id}: ${j.error?.message || r.status}`); continue; }
    console.log(`  - ${COLLECTIONS[d.col]} verwijderd: ${line(d)}`);
  }
}

// ---- cli -------------------------------------------------------------------------------------------
const [cmd = 'list', ...args] = process.argv.slice(2);
if (cmd === 'list') {
  const all = await listAll();
  for (const col of Object.keys(COLLECTIONS)) {
    const rows = all.filter(d => d.col === col);
    console.log(`\n${col} (${rows.length}):`);
    for (const d of rows) console.log('  ' + line(d));
  }
  console.log('\nVerwijderen: npm run chat -- delete <id> [id...]');
} else if (cmd === 'delete' && args.length) {
  await remove(args);
} else {
  console.error('Gebruik: npm run chat            (lijst)\n         npm run chat -- delete <id> [id...]');
  process.exit(1);
}
