// Version history: snapshots, external-edit detection, history panel and restore.
const lastKnown = {}; // what we last read from / wrote to each map file; a difference means someone else (e.g. an AI) edited it
const snapDir = (id) => '.history/' + id.replace(/\//g, '__').slice(0, -EXT.length);
async function listSnaps(id) {
  try {
    const d = await dirAt(snapDir(id)),
      a = [];
    for await (const [n] of d.entries()) a.push(n);
    return a.sort();
  } catch {
    return [];
  }
}
async function snapshot(id, text, tag) {
  if (!text || text === 'null') return;
  try {
    const names = await listSnaps(id);
    if (names.length && (await readText(snapDir(id) + '/' + names[names.length - 1])) === text)
      return;
    await writeText(
      snapDir(id) + '/' + new Date().toISOString().replace(/[:.]/g, '-') + '~' + tag + EXT,
      text,
    );
    const d = await dirAt(snapDir(id));
    names
      .slice(0, Math.max(0, names.length + 1 - 60))
      .forEach((n) => d.removeEntry(n).catch(() => {}));
  } catch {}
}
async function checkExternal() {
  // file changed on disk behind our back -> keep the old version in history, load the new one
  if (!rootH || !cur || !loaded || editing || running || pending.size) return;
  let t;
  try {
    t = await readText(cur);
  } catch {
    return;
  }
  if (lastKnown[cur] === undefined) {
    lastKnown[cur] = t;
    return;
  }
  if (t === lastKnown[cur]) return;
  let d;
  try {
    d = JSON.parse(t);
    if (!d.root) throw 0;
  } catch {
    status('⚠ file on disk is not a valid map (left untouched)');
    return;
  }
  await snapshot(cur, lastKnown[cur], 'before-ext');
  lastKnown[cur] = t;
  const v = view;
  setState(d);
  view = v;
  build();
  status('↻ updated from disk (changed outside the app) — old version is in History');
}
setInterval(() => {
  if (!document.hidden) checkExternal();
}, 3000);
addEventListener('focus', checkExternal);
const when = (n) => {
  const m = n.match(/^(.*?)~(.*)\.kundhan$/) || [null, n.replace(EXT, ''), 'old'];
  const t = m[1].replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z/, 'T$1:$2:$3.$4Z');
  return { d: new Date(t), tag: m[2] };
};
const bagOf = (rs) => {
  const m = new Map();
  const w = (n) => {
    m.set(n.t, (m.get(n.t) || 0) + 1);
    n.c.forEach(w);
  };
  rs.forEach(w);
  return m;
};
const total = (bag) => [...bag.values()].reduce((a, b) => a + b, 0);
const diffTexts = (a, b) => {
  const out = [];
  for (const [t, c] of a) {
    const k = c - (b.get(t) || 0);
    for (let i = 0; i < k; i++) out.push(t);
  }
  return out;
};
async function openHistory() {
  if (!loaded || !cur) return;
  const id = cur;
  $('#hist').style.display = 'flex';
  const hl = $('#hl');
  hl.textContent = 'Loading…';
  const names = (await listSnaps(id)).reverse(),
    curBag = bagOf(roots());
  hl.textContent = '';
  if (!names.length) hl.textContent = 'No earlier versions yet — they appear as you edit.';
  for (const n of names) {
    let txt, snapRoots;
    try {
      txt = await readText(snapDir(id) + '/' + n);
      const sd0 = JSON.parse(txt);
      snapRoots = [sd0.root, ...(Array.isArray(sd0.more) ? sd0.more : [])];
    } catch {
      continue;
    }
    const sb = bagOf(snapRoots),
      w = when(n),
      back = diffTexts(sb, curBag),
      gone = diffTexts(curBag, sb);
    const row = document.createElement('div');
    row.className = 'hr';
    const sm = (a, s) =>
      a.length
        ? s +
          a.length +
          ' ' +
          a
            .slice(0, 3)
            .map((x) => '"' + (x.length > 16 ? x.slice(0, 15) + '…' : x) + '"')
            .join(' ') +
          (a.length > 3 ? ' …' : '')
        : '';
    row.innerHTML = '<span class="tm"></span><span class="df"></span><button>Restore</button>';
    row.querySelector('.tm').innerHTML =
      w.d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      '<span class="tg">' +
      w.tag +
      '</span>';
    row.querySelector('.df').textContent =
      total(sb) +
      ' nodes · ' +
      (!back.length && !gone.length
        ? 'same text as now'
        : [sm(back, 'brings back '), sm(gone, 'drops ')].filter(Boolean).join(' · '));
    row.querySelector('button').onclick = () => restore(id, n);
    hl.appendChild(row);
  }
}
async function restore(id, name) {
  if (!(await okay('Restore this version? The current one is saved to history first.'))) return;
  await flush();
  const snap = await readText(snapDir(id) + '/' + name),
    curTxt = await readText(id).catch(() => null);
  await snapshot(id, curTxt, 'before-restore');
  await writeText(id, snap);
  lastKnown[id] = snap;
  pending.delete(id);
  localStorage.removeItem('mmD:' + kp(id));
  const v = view;
  loaded = false;
  setState(JSON.parse(snap));
  view = v;
  loaded = true;
  build();
  apply();
  $('#hist').style.display = 'none';
  status('restored · previous version kept in History');
}
$('#bh').onclick = openHistory;
$('#hx').onclick = () => ($('#hist').style.display = 'none');
$('#hist').onmousedown = (e) => {
  if (e.target.id === 'hist') $('#hist').style.display = 'none';
};
addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && $('#hist').style.display !== 'none') {
      $('#hist').style.display = 'none';
    }
  },
  true,
);
