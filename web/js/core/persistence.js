// Persistence: folder/file helpers (File System Access API) and the save guarantee.
let rootH = null,
  items = [],
  cur = null,
  loaded = false,
  openF = new Set(JSON.parse(localStorage.mmOpen || '[]')),
  selFolder = null;
const idb = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open('mm', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const kvGet = async (k) => {
  const d = await idb();
  return new Promise((res) => {
    const q = d.transaction('kv').objectStore('kv').get(k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => res(null);
  });
};
const kvSet = async (k, v) => {
  const d = await idb();
  return new Promise((res) => {
    const t = d.transaction('kv', 'readwrite');
    t.objectStore('kv').put(v, k);
    t.oncomplete = () => res();
  });
};
const split = (p) => {
  const i = p.lastIndexOf('/');
  return [i < 0 ? '' : p.slice(0, i), p.slice(i + 1)];
};
const clean = (s) => s.replace(/[\\/:*?"<>|]/g, '-').trim();
const kp = (id) => (rootH ? rootH.name : '') + '|' + id; // browser-backup key, per folder
async function dirAt(path, create) {
  let d = rootH;
  for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create });
  return d;
}
async function readText(path) {
  const [d, n] = split(path);
  return (await (await (await dirAt(d)).getFileHandle(n)).getFile()).text();
}
async function writeText(path, text) {
  const [d, n] = split(path);
  const fh = await (await dirAt(d, true)).getFileHandle(n, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
} // swapped in on close: never a half-written file
async function exists(dir, name) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {}
  try {
    await dir.getDirectoryHandle(name);
    return true;
  } catch {}
  return false;
}
async function uniq(dir, name) {
  if (!(await exists(dir, name))) return name;
  const i = name.lastIndexOf('.'),
    b = i > 0 ? name.slice(0, i) : name,
    e = i > 0 ? name.slice(i) : '';
  for (let k = 2; ; k++) if (!(await exists(dir, `${b} (${k})${e}`))) return `${b} (${k})${e}`;
}
async function scan(dir, prefix, out) {
  const list = [];
  for await (const e of dir.entries()) list.push(e);
  for (const [n, h] of list) {
    if (n.startsWith('.')) continue;
    const parent = prefix.slice(0, -1) || null;
    if (h.kind === 'directory') {
      out.push({ id: prefix + n, name: n, type: 'folder', parent });
      await scan(h, prefix + n + '/', out);
    } else if (n.endsWith(EXT))
      out.push({ id: prefix + n, name: n.slice(0, -EXT.length), type: 'map', parent });
  }
}
async function rescan() {
  const out = [];
  await scan(rootH, '', out);
  items = out;
  renderTree();
}
async function copyTo(srcDir, name, isDir, dstDir, newName) {
  if (isDir) {
    const s = await srcDir.getDirectoryHandle(name),
      d = await dstDir.getDirectoryHandle(newName, { create: true });
    for await (const [n, h] of s.entries()) await copyTo(s, n, h.kind === 'directory', d, n);
  } else {
    const f = await (await srcDir.getFileHandle(name)).getFile();
    const w = await (await dstDir.getFileHandle(newName, { create: true })).createWritable();
    await w.write(f);
    await w.close();
  }
}
async function moveEntry(it, dstPath, newName) {
  // copy first, delete source only after the copy succeeded
  await flush();
  const [sp, sn] = split(it.id),
    srcDir = await dirAt(sp),
    dstDir = await dirAt(dstPath, true),
    isDir = it.type === 'folder';
  const nn = await uniq(dstDir, newName || sn);
  await copyTo(srcDir, sn, isDir, dstDir, nn);
  await srcDir.removeEntry(sn, { recursive: true });
  if (cur && (cur === it.id || cur.startsWith(it.id + '/'))) lock();
  await rescan();
  return nn;
}

// every change hits browser storage first, then the file, retried until confirmed
const pending = new Map(),
  lastSnap = {};
let timer = null,
  running = false;
function save() {
  if (!loaded || !cur) return;
  trackUndo();
  const s = JSON.stringify({ root, more, uid, view, numbered });
  localStorage['mm:' + kp(cur)] = s;
  localStorage['mmD:' + kp(cur)] = '1';
  pending.set(cur, s);
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
  status('saving…');
}
async function flush() {
  clearTimeout(timer);
  if (running) return;
  if (!rootH) return;
  running = true;
  try {
    while (pending.size) {
      const [id, s] = pending.entries().next().value;
      try {
        const old = await readText(id).catch(() => null);
        if (old && old !== 'null') {
          if (lastKnown[id] !== undefined && old !== lastKnown[id])
            await snapshot(id, old, 'ext'); // edited outside while we had unsaved changes
          else if (Date.now() - (lastSnap[id] || 0) > 60e3) {
            lastSnap[id] = Date.now();
            await snapshot(id, old, 'auto');
          }
        }
        await writeText(id, s);
        lastKnown[id] = s;
        if (pending.get(id) === s) {
          pending.delete(id);
          localStorage.removeItem('mmD:' + kp(id));
        }
      } catch {
        status(`⚠ ${pending.size} unsaved — retrying (kept safe in browser)`);
        timer = setTimeout(flush, 2000);
        return;
      }
    }
    status('saved ✓ · ' + rootH.name);
  } finally {
    running = false;
  }
}
// file writes can't be forced during unload, so warn; the unsynced copy in browser storage is pushed on next open
addEventListener('beforeunload', (e) => {
  if (pending.size) {
    e.preventDefault();
    e.returnValue = '';
  }
});
addEventListener('visibilitychange', () => {
  if (document.hidden) flush();
});
