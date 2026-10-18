// Subjects: per-root tree layout (children beside parent, branches split left/right) and Cmd/Ctrl+drag to move a subject.
let subjDrag = null;
function layoutRoot(R) {
  const before = new Set(pos.keys()),
    rootW = els.get(R).offsetWidth,
    groups = { r: [], l: [] };
  if (!R.col) for (const c of R.c) groups[sd(c)].push(c);
  const side1 = (list, s) => {
    let cursor = 0;
    const own = [];
    const l = (n, edge, d) => {
      const w = els.get(n).offsetWidth,
        h = els.get(n).offsetHeight,
        x = s === 'r' ? edge + GX : edge - GX - w,
        kids = n.col ? [] : n.c;
      let y;
      sideOf.set(n, s);
      if (!kids.length) {
        y = cursor;
        cursor += h + GY;
      } else {
        kids.forEach((c, i) => {
          l(c, s === 'r' ? x + w : x, d + 1);
          if (c.c.length && !c.col && i < kids.length - 1) cursor += GB;
        }); // extra air between branches
        const a = pos.get(kids[0]),
          z = pos.get(kids[kids.length - 1]);
        y = (a.y + a.h / 2 + z.y + z.h / 2) / 2 - h / 2;
      }
      pos.set(n, { x, y, d, h });
      own.push(n);
    };
    list.forEach((c, i) => {
      l(c, s === 'r' ? rootW : 0, 1);
      if (c.c.length && !c.col && i < list.length - 1) cursor += GB;
    });
    if (!list.length) return;
    const a = pos.get(list[0]),
      z = pos.get(list[list.length - 1]),
      cy = (a.y + a.h / 2 + z.y + z.h / 2) / 2; // centre line of this side
    for (const n of own) pos.get(n).y -= cy;
  };
  side1(groups.r, 'r');
  side1(groups.l, 'l');
  const rh = els.get(R).offsetHeight;
  pos.set(R, { x: 0, y: -rh / 2, d: 0, h: rh });
  const mine = [...pos.keys()].filter((n) => !before.has(n));
  const minY = Math.min(...mine.map((n) => pos.get(n).y));
  for (const n of mine) {
    const q = pos.get(n);
    q.y += (R.oy || 0) - minY;
    q.x += R.ox || 0;
  }
}
addEventListener('mousemove', (ev) => {
  if (!subjDrag) return;
  const d = subjDrag;
  if (!d.on && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) return;
  d.on = true;
  d.r.ox = d.ox + (ev.clientX - d.x) / view.k;
  d.r.oy = d.oy + (ev.clientY - d.y) / view.k;
  dragMoved = true;
  place();
});
addEventListener('mouseup', () => {
  subjDrag = null;
});
