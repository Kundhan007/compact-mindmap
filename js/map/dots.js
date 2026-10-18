// Connection dots shown when the pointer is near a node.
const dotsEl = $('#dots');
let dotNode = null;
function hideDots() {
  dotsEl.innerHTML = '';
  dotsEl.classList.remove('dd');
  dotNode = null;
}
function dotAction(n, type, side) {
  if (!isRoot(n) && !parentOf(n)) return;
  sel = n;
  if (type === 'child') child(side);
  else if (type === 'before') siblingBefore();
  else sibling();
}
function showDots(n) {
  if (dotNode === n) return;
  hideDots();
  dotNode = n;
  const p = pos.get(n),
    w = els.get(n).offsetWidth,
    cy = p.y + p.h / 2,
    side = sideOf.get(n),
    col = lastColr.get(n) || '#7aa8ff',
    o = 13,
    list = [];
  if (isRoot(n)) {
    list.push({
      x: p.x - o,
      y: cy,
      t: 'child',
      s: 'l',
      tip: 'Add branch on the left',
      con: n.c.some((c) => sd(c) === 'l'),
    });
    list.push({
      x: p.x + w + o,
      y: cy,
      t: 'child',
      s: 'r',
      tip: 'Add branch on the right',
      con: n.c.some((c) => sd(c) === 'r'),
    });
  } else {
    const out = side === 'l' ? -1 : 1;
    list.push({
      x: out > 0 ? p.x + w + o : p.x - o,
      y: cy,
      t: 'child',
      tip: 'Add child',
      con: n.c.length > 0 && !n.col,
    });
    list.push({ x: out > 0 ? p.x : p.x + w, y: cy, t: 'link' }); // already connected to its parent
    list.push({ x: p.x + w / 2, y: p.y - o + 3, t: 'before', tip: 'Add sibling above' });
    list.push({ x: p.x + w / 2, y: p.y + p.h + o - 3, t: 'after', tip: 'Add sibling below' });
  }
  for (const d of list) {
    const e = document.createElement('div');
    e.className = 'dot' + (d.t === 'link' ? ' link' : d.con ? ' con' : '');
    e.style.left = d.x + 'px';
    e.style.top = d.y + 'px';
    e.style.setProperty('--c', col);
    if (d.tip) e.title = d.tip;
    if (d.t !== 'link') {
      e.onmousedown = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      e.onclick = (ev) => {
        ev.stopPropagation();
        dotAction(n, d.t, d.s);
      };
    }
    dotsEl.appendChild(e);
  }
}
stage.addEventListener('mousemove', (ev) => {
  if (!loaded || !root || editing || drag || dragging || dragInit) {
    if (dotNode) hideDots();
    return;
  }
  const r = stage.getBoundingClientRect(),
    wx = (ev.clientX - r.left - view.x) / view.k,
    wy = (ev.clientY - view.y) / view.k,
    m = 26;
  let best = null,
    bd = 1e9;
  for (const [n, p] of pos) {
    const w = els.get(n).offsetWidth,
      dx = Math.max(p.x - wx, 0, wx - (p.x + w)),
      dy = Math.max(p.y - wy, 0, wy - (p.y + p.h));
    if (dx <= m && dy <= m) {
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
  }
  if (best) showDots(best);
  else if (dotNode) hideDots();
});
stage.addEventListener('mouseleave', hideDots);
