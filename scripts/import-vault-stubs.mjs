// One-off: import Obsidian vault project stubs into Protask (workspaces/projects/tasks).
// Manifest: scripts/vault-stubs-manifest.json (generated from the vault during the
// 2026-07 LLM-Wiki migration — see Obsidian_Vault plan).
//
// SAFETY: dry-run by default — prints what it WOULD create. Pass --apply to insert.
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env (repo root).
//
// Usage: node scripts/import-vault-stubs.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APPLY = process.argv.includes('--apply');

// ---- env ----
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+[A-Z0-9_]*)\s*=\s*(.+)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env'); process.exit(1); }
const REST = `${URL_}/rest/v1`;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const nid = p => `${p}_${Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')}`;

async function get(q) {
  const r = await fetch(`${REST}/${q}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`GET ${q} -> ${r.status} ${await r.text()}`);
  return r.json();
}
async function post(table, rows) {
  const r = await fetch(`${REST}/${table}`, {
    method: 'POST', headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`POST ${table} -> ${r.status} ${await r.text()}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'vault-stubs-manifest.json'), 'utf8'));

const existingWs = await get('workspaces?select=id,name');
console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}   existing workspaces: ${existingWs.map(w => w.id).join(', ') || '(none)'}\n`);

let nW = 0, nP = 0, nT = 0;
for (const ws of manifest.workspaces) {
  const found = existingWs.find(w => w.id === ws.id || w.name === ws.name);
  const wsId = found?.id ?? ws.id;
  if (!found) {
    nW++;
    console.log(`+ workspace ${wsId} (${ws.name})`);
    if (APPLY) await post('workspaces', [{ id: wsId, name: ws.name, position: 0 }]);
  } else console.log(`= workspace ${wsId} (exists)`);

  const existingPr = APPLY || found ? await get(`projects?workspace_id=eq.${encodeURIComponent(wsId)}&select=id,title`) : [];
  let ppos = 1024 * (existingPr.length + 1);
  for (const pr of ws.projects) {
    if (existingPr.some(p => p.title === pr.title)) { console.log(`  = project "${pr.title}" (exists — skip)`); continue; }
    const prId = nid('prj');
    nP++;
    console.log(`  + project "${pr.title}" [${pr.status}] tasks:${pr.tasks.length}`);
    if (APPLY) await post('projects', [{ id: prId, workspace_id: wsId, title: pr.title, descr: pr.descr ?? '', status: pr.status, position: (ppos += 1024) }]);
    let tpos = 0;
    const rows = pr.tasks.map(t => ({
      id: nid('tsk'), workspace_id: wsId, project_id: APPLY ? prId : null,
      title: t.title, notes: t.notes ?? '', status: t.done ? 'done' : 'todo',
      position: (tpos += 1024),
      checklist: (t.checklist ?? []).map(c => ({ id: nid('chk'), title: c.title, done: !!c.done, children: [] })),
      labels: t.labels ?? [],
      completed_at: t.done ? new Date().toISOString() : null,
    }));
    for (const t of pr.tasks) console.log(`      ${t.done ? '[x]' : '[ ]'} ${t.title}${(t.checklist?.length ? `  (+체크리스트 ${t.checklist.length})` : '')}`);
    nT += rows.length;
    if (APPLY && rows.length) await post('tasks', rows);
  }
}
console.log(`\n${APPLY ? 'DONE' : 'dry-run'}: workspaces +${nW}, projects +${nP}, tasks +${nT}`);
if (!APPLY) console.log('실제 등록: node scripts/import-vault-stubs.mjs --apply');
