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
    if (Math.hypot(ev.clientX - dragInit.x, ev.clientY - dragInit.y) < 6) return;
    dragging = dragInit.n;
    dragMoved = true;
    const src = els.get(dragging);
    ghost = src.cloneNode(true);
    ghost.className = 'n ghost';
    document.body.appendChild(ghost);
    src.style.opacity = '.35';
  }
  ghost.style.left = ev.clientX + 10 + 'px';
  ghost.style.top = ev.clientY + 10 + 'px';
  const hit = document.elementFromPoint(ev.clientX, ev.clientY),
    he = hit && hit.closest && hit.closest('.n:not(.ghost)');
  let t = null;
  if (he)
    for (const [n, e] of els)
      if (e === he) {
        t = n;
        break;
      }
  clearDT();
  if (t && !inSub(dragging, t)) {
    const r = he.getBoundingClientRect(),
      f = (ev.clientY - r.top) / r.height;
    dzone = isRoot(t) || (f > 0.25 && f < 0.75) ? 'child' : f <= 0.25 ? 'before' : 'after';
    dtarget = t;
    dside = isRoot(t) ? (ev.clientX < r.left + r.width / 2 ? 'l' : 'r') : null;
    he.classList.add('dt-' + dzone);
    if (dside) he.classList.add('dt-s' + dside);
  }
  if (dtarget) {
    showDots(dtarget); // the dots belong to the incoming node, not the dragged one
    dotsEl.classList.add('dd');
  } else hideDots();
});
addEventListener('mouseup', () => {
  if (dragging) {
    const n = dragging,
      t = dtarget,
      z = dzone,
      ds = dside,
      src = els.get(n);
    if (ghost) ghost.remove();
    ghost = null;
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
