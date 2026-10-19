// App state and session lifecycle: shared globals, locking/opening a map, connecting the folder, startup.
const GX = 28,
  GY = 8,
  GB = 6,
  H = 22,
  EXT = '.kundhan'; // plain JSON content, own extension
const PAL = [
  '#e8683a',
  '#56b4e9',
  '#f0e442',
  '#9b8ce8',
  '#2fc4a0',
  '#d98bb8',
  '#f0a830',
  '#5b8def',
]; // Okabe-Ito hues lightened for dark backgrounds, ordered warm/cool so neighbours contrast
let uid = 1,
  root,
  more = [], // extra subjects: separate roots on the same canvas (node.ox / node.oy = position)
  sel,
  editing = null,
  view = { x: 60, y: 0, k: 1 };
const $ = (s) => document.querySelector(s),
  stage = $('#stage'),
  world = $('#world'),
  svg = $('#lines');
const mk = (t = '') => ({ id: uid++, t, c: [], col: false });
const roots = () => [root, ...more],
  isRoot = (n) => n === root || more.includes(n);
const has = (a, b) => a === b || a.c.some((c) => has(c, b)),
  rootOf = (n) => roots().find((r) => has(r, n)) || root;
function parentOf(n, r) {
  if (!r) {
    for (const x of roots()) {
      const p = parentOf(n, x);
      if (p) return p;
    }
    return null;
  }
  for (const c of r.c) {
    if (c === n) return r;
    const p = parentOf(n, c);
    if (p) return p;
  }
  return null;
}
const els = new Map(),
  pos = new Map(),
  sideOf = new Map();
let lastColr = new Map();
const sd = (c) => (c.side === 'l' ? 'l' : 'r'); // top-level branch side; nodes without it (older maps) sit on the right
function assignSide(n, R = parentOf(n) || root) {
  // fill 3 on the right, then 3 on the left, then keep balanced
  const r = R.c.filter((c) => c !== n && sd(c) === 'r').length,
    l = R.c.filter((c) => c !== n && sd(c) === 'l').length;
  return r < 3 ? 'r' : l < 3 ? 'l' : l < r ? 'l' : 'r';
}

const status = (s) => ($('#status').textContent = s);
let numbered = false; // per-map flag stored in the file; maps without it open un-numbered, exactly as before
function norm() {
  // be forgiving about files edited by hand or by an AI: missing ids/children/text are repaired
  let mx = uid || 1;
  for (const r0 of roots())
    (function w(n) {
      if (typeof n.t !== 'string') n.t = String(n.t ?? '');
      if (!Array.isArray(n.c)) n.c = [];
      n.col = !!n.col;
      if (typeof n.id === 'number') mx = Math.max(mx, n.id + 1);
      n.c.forEach(w);
    })(r0);
  for (const r0 of roots())
    (function w(n) {
      if (typeof n.id !== 'number') n.id = mx++;
      n.c.forEach(w);
    })(r0);
  uid = mx;
}
function setState(d) {
  if (d && d.root) {
    root = d.root;
    more = Array.isArray(d.more) ? d.more.filter((m) => m && typeof m === 'object') : [];
    uid = d.uid || 1;
    view = d.view || { x: 60, y: 0, k: 1 };
    sel = root;
    numbered = !!d.numbered;
    norm();
  } else {
    root = mk('Central idea');
    more = [];
    sel = root;
    numbered = false;
    view = { x: stage.clientWidth / 2 - 60, y: stage.clientHeight / 2 - H / 2, k: 1 };
  }
}

function lockUI(msg, btn, fn) {
  $('#lock').style.display = 'flex';
  $('#lockmsg').textContent = msg;
  const b = $('#lockbtn');
  b.style.display = btn ? '' : 'none';
  b.textContent = btn || '';
  b.onclick = fn;
}
function lock() {
  // no map selected -> nothing editable
  editing = null;
  loaded = false;
  cur = null;
  root = null;
  more = [];
  sel = null;
  for (const e of els.values()) e.remove();
  els.clear();
  pos.clear();
  svg.innerHTML = '';
  lockUI('Select a map on the left (or create one) to start editing');
  renderTree();
}
async function openMap(id) {
  await flush();
  loaded = false;
  cur = id;
  localStorage.mmLast = id; // a refresh reopens the same map
  const want = +localStorage['mmSel:' + kp(id)];
  let d = null,
    local = null;
  try {
    local = JSON.parse(localStorage['mm:' + kp(id)]);
  } catch {}
  if (local && localStorage['mmD:' + kp(id)]) {
    d = local;
    pending.set(id, JSON.stringify(local));
  } // unsynced edits win
  else {
    let txt = null;
    try {
      txt = await readText(id);
      d = JSON.parse(txt);
    } catch {}
    if (!d && local) d = local;
    if (txt != null) {
      lastKnown[id] = txt;
      snapshot(id, txt, 'open');
    }
  }
  $('#lock').style.display = 'none';
  const fresh = !(d && d.root);
  setState(d);
  loaded = true;
  if (pending.has(id)) flush();
  const it = items.find((i) => i.id === id);
  if (it && it.parent) selFolder = it.parent;
  renderTree();
  build();
  apply();
  restoreUI(want);
  if (fresh) {
    save();
    edit(root);
  }
}
async function connect() {
  status('folder: ' + rootH.name);
  await rescan();
  for (const i of items)
    if (i.type === 'map' && localStorage['mmD:' + kp(i.id)]) {
      pending.set(i.id, localStorage['mm:' + kp(i.id)]);
    } // unsynced from last session
  if (pending.size) flush();
  const last = localStorage.mmLast;
  if (last && items.some((i) => i.type === 'map' && i.id === last)) return openMap(last);
  lock();
}
async function chooseFolder() {
  try {
    rootH = await showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return;
  }
  if (!NATIVE) await kvSet('root', rootH);
  await connect();
}

addEventListener('load', async () => {
  if (!NATIVE && !('showDirectoryPicker' in window)) {
    lockUI('This needs Chrome or Edge (File System Access API).');
    return;
  }
  rootH = NATIVE ? await nativeRoot() : await kvGet('root');
  if (!rootH)
    return lockUI(
      'Choose a folder to keep your mind maps in (each map is a .kundhan file)',
      'Choose folder',
      chooseFolder,
    );
  if ((await rootH.queryPermission({ mode: 'readwrite' })) === 'granted') return connect();
  lockUI(`Reconnect to folder "${rootH.name}"`, 'Allow access', async () => {
    if ((await rootH.requestPermission({ mode: 'readwrite' })) === 'granted') connect();
  });
});
