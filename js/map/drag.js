// Dragging nodes to re-parent/reorder, plus canvas pan and zoom.
let dragInit = null,
  dragging = null,
  ghost = null,
  dtarget = null,
  dzone = null,
  dside = null,
  dragMoved = false;
const inSub = (a, b) => a === b || a.c.some((c) => inSub(c, b)); // is b inside a's subtree (a branch can't be dropped into itself)
function clearDT() {
  if (dtarget) {
    const e = els.get(dtarget);
    if (e) e.classList.remove('dt-child', 'dt-before', 'dt-after', 'dt-sl', 'dt-sr');
  }
  dtarget = null;
  dzone = null;
}
addEventListener('mousemove', (ev) => {
  if (!dragInit) return;
  if (!dragging) {
    if (Math.hypot(ev.clientX - dragInit.x, ev.clientY - dragInit.y) < 4) return;
    dragging = dragInit.n;
    dragMoved = true;
    const src = els.get(dragging);
    ghost = src.cloneNode(true);
    ghost.className = 'n ghost';
    ghost.style.left = ghost.style.top = '0';
    document.body.appendChild(ghost);
    document.body.classList.add('dragging');
    getSelection().removeAllRanges();
    src.style.opacity = '.35';
  }
  ghost.style.transform = `translate(${ev.clientX + 10}px, ${ev.clientY + 10}px)`;
  const t = pickTarget(ev);
  clearDT();
  if (t) {
    const e = els.get(t.n);
    dzone = t.zone;
    dtarget = t.n;
    dside = t.side;
    e.classList.add('dt-' + dzone);
    if (dside) e.classList.add('dt-s' + dside);
    showDots(dtarget); // the dots belong to the incoming node, not the dragged one
    dotsEl.classList.add('dd');
  } else hideDots();
});
// magnetic: the nearest node within reach wins (not only the one under the pointer); the previous target is sticky
function pickTarget(ev) {
  const r = stage.getBoundingClientRect(),
    wx = (ev.clientX - r.left - view.x) / view.k,
    wy = (ev.clientY - r.top - view.y) / view.k,
    reach = 44 / view.k;
  let best = null,
    bd = 1e9,
    prev = null;
  for (const [n, p] of pos) {
    if (inSub(dragging, n)) continue;
    const w = els.get(n).offsetWidth,
      dx = Math.max(p.x - wx, 0, wx - (p.x + w)),
      dy = Math.max(p.y - wy, 0, wy - (p.y + p.h)),
      d = Math.hypot(dx, dy);
    if (d > reach) continue;
    if (n === dtarget) prev = d;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  if (dtarget && prev !== null && prev <= bd + 8 / view.k) best = dtarget;
  if (!best) return null;
  const p = pos.get(best),
    w = els.get(best).offsetWidth,
    f = (wy - p.y) / p.h;
  if (isRoot(best)) return { n: best, zone: 'child', side: wx < p.x + w / 2 ? 'l' : 'r' };
  const inside = wx >= p.x && wx <= p.x + w;
  return {
    n: best,
    zone: !inside || (f > 0.25 && f < 0.75) ? 'child' : f <= 0.25 ? 'before' : 'after',
    side: null,
  };
}
addEventListener('mouseup', () => {
  if (dragging) {
    const n = dragging,
      t = dtarget,
      z = dzone,
      ds = dside,
      src = els.get(n);
    if (ghost) ghost.remove();
    ghost = null;
    document.body.classList.remove('dragging');
    clearDT();
    dragging = null;
    if (src) src.style.opacity = '';
    if (t) {
      const op = parentOf(n);
      op.c.splice(op.c.indexOf(n), 1);
      if (z === 'child') {
        t.col = false;
        t.c.push(n);
        if (isRoot(t)) n.side = ds || assignSide(n);
        else delete n.side;
      } else {
        const tp = parentOf(t);
        tp.c.splice(tp.c.indexOf(t) + (z === 'after' ? 1 : 0), 0, n);
        if (isRoot(tp)) n.side = sd(t);
        else delete n.side;
      }
      sel = n;
      build();
      reveal();
    }
  }
  dragInit = null;
});
let drag = null;
stage.onmousedown = (e) => {
  drag = { x: e.clientX - view.x, y: e.clientY - view.y };
  stage.style.cursor = 'grabbing';
};
addEventListener('mousemove', (e) => {
  if (drag) {
    view.x = e.clientX - drag.x;
    view.y = e.clientY - drag.y;
    apply();
  }
});
addEventListener('mouseup', () => {
  if (drag) {
    drag = null;
    stage.style.cursor = 'grab';
    save();
  }
});
stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const L = stage.getBoundingClientRect().left,
        cx = e.clientX - L,
        cy = e.clientY;
      const f = Math.exp(-e.deltaY * 0.01),
        k = Math.min(3, Math.max(0.2, view.k * f)),
        r = k / view.k;
      view.x = cx - (cx - view.x) * r;
      view.y = cy - (cy - view.y) * r;
      view.k = k;
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
    }
    apply();
    save();
  },
  { passive: false },
);
