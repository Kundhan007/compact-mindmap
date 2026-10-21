// Silent timers: select a node, type t, the minutes, Enter -> a timer leaf under it.
// It breathes slowly while running; when done a silent notification is sent and it blinks until selected.
const tmEl = Object.assign(document.createElement('div'), { id: 'tmin' });
world.appendChild(tmEl);
let tmBuf = null; // minutes typed after t, null when not entering a timer
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function tmShow() {
  const p = tmBuf !== null && sel && pos.get(sel);
  tmEl.style.display = p ? 'block' : 'none';
  if (!p) return;
  tmEl.textContent = `⏱ ${tmBuf || '_'} min  ⏎`;
  tmEl.style.left = p.x + 'px';
  tmEl.style.top = p.y + p.h + 6 + 'px';
}
function tmEnd() {
  tmBuf = null;
  tmShow();
}
function addTimer(n, min) {
  const end = Date.now() + min * 60000,
    t = { id: uid++, t: `⏱ ${min}m · ${clock(end)}`, c: [], col: false, tm: { min, end } };
  n.col = false;
  n.c.push(t);
  if (isRoot(n)) t.side = assignSide(t);
  if (!NATIVE && window.Notification && Notification.permission === 'default') Notification.requestPermission();
  build();
  status(`timer set: ${min} min, done at ${clock(end)}`);
}
function tmNotify(msg) {
  if (NATIVE) window.ipc.postMessage(JSON.stringify({ op: 'notify', t: msg }));
  else if (window.Notification && Notification.permission === 'granted')
    new Notification('Mindmap', { body: msg, silent: true });
}
setInterval(() => {
  if (!loaded || !root) return;
  let hit = false;
  for (const R of roots())
    (function w(n, p) {
      if (n.tm && !n.tm.fired && Date.now() >= n.tm.end) {
        n.tm.fired = true;
        n.t = `⏱ ${n.tm.min}m · done ${clock(n.tm.end)}`;
        tmNotify(`${n.tm.min} min timer done${p && p.t ? ': ' + p.t : ''}`);
        hit = true;
      }
      n.c.forEach((c) => w(c, n));
    })(R, null);
  if (hit) build();
}, 1000);
addEventListener(
  'keydown',
  (ev) => {
    if (editing || !loaded || !cur || !root || !sel || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    if (tmBuf === null) {
      if (k !== 't') return;
      tmBuf = '';
    } else if (/^\d$/.test(k)) tmBuf += k;
    else if (k === 'Backspace') tmBuf ? (tmBuf = tmBuf.slice(0, -1)) : tmEnd();
    else if (k === 'Enter') {
      const m = +tmBuf;
      tmEnd();
      if (m > 0) addTimer(sel, m);
    } else if (k === 'Escape') tmEnd();
    else if (k === 'Shift') return;
    else {
      // not a timer after all: type "t…" and this key into the node, as plain typing would
      const had = tmBuf;
      tmEnd();
      sel.t = 't' + had;
      edit(sel, true);
      return;
    }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    tmShow();
  },
  true,
);
addEventListener('mousedown', () => tmBuf !== null && tmEnd(), true);
