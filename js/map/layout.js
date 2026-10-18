// Rendering: DOM nodes, two-sided compact layout, connectors, colours, numbering, viewport.
function build() {
  for (const e of els.values()) e.remove();
  els.clear();
  const w = (n) => {
    const e = document.createElement('div');
    e.className = 'n';
    e.textContent = n.t;
    let was = false; // click on an already-selected node edits it
    e.onmousedown = (ev) => {
      ev.stopPropagation();
      dragMoved = false;
      was = sel === n && !editing;
      select(n);
      if ((ev.metaKey || ev.ctrlKey || isRoot(n)) && editing !== n) {
        // Cmd/Ctrl+drag any node, or plain drag a subject's root, moves the whole subject
        const r = rootOf(n);
        if (ev.metaKey || ev.ctrlKey) was = false;
        subjDrag = { r, x: ev.clientX, y: ev.clientY, ox: r.ox || 0, oy: r.oy || 0, on: false };
      } else if (editing !== n && !isRoot(n) && ev.button === 0)
        dragInit = { n, x: ev.clientX, y: ev.clientY };
    };
    e.onclick = () => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      if (was && !editing) {
        was = false;
        edit(n);
      }
    };
    e.ondblclick = () => {
      if (editing !== n) edit(n);
    };
    world.appendChild(e);
    els.set(n, e);
    if (!n.col) n.c.forEach(w);
  };
  roots().forEach(w);
  place();
}
function place() {
  hideDots();
  // numbering is display-only (data-num -> CSS ::before); node text is never modified
  const num = new Map();
  const nn = (n, pre) =>
    n.c.forEach((c, i) => {
      const s = pre ? pre + '.' + (i + 1) : '' + (i + 1);
      num.set(c, s);
      nn(c, s);
    });
  roots().forEach((R) => nn(R, ''));
  for (const [n, e] of els) {
    if (numbered && num.has(n)) e.dataset.num = num.get(n);
    else delete e.dataset.num;
  }
  $('#bn').classList.toggle('on', numbered);
  pos.clear();
  sideOf.clear();
  roots().forEach(layoutRoot);
  // branch colours: the first level that actually branches gets a palette colour per child, inherited down; node.color overrides (Alt+1..8)
  const colr = new Map();
  const cc = (n, inh, top, off) =>
    n.c.forEach((c, i) => {
      const k = c.color || (top ? PAL[(i + off) % PAL.length] : inh);
      colr.set(c, k);
      cc(c, k, top && n.c.length === 1, off + 1);
    });
  roots().forEach((R) => cc(R, null, true, 0));
  lastColr = colr;
  glide(colr);
  rememberSel();
  save();
}
// Motion: nodes and connectors glide to their new place instead of jumping (rebuilds keep the old positions in `shown`).
const shown = new Map();
let raf = 0;
function paint(P, colr) {
  let d = '';
  for (const [n, p] of P) {
    const e = els.get(n),
      k = colr.get(n);
    e.style.left = p.x + 'px';
    e.style.top = p.y + 'px';
    e.classList.toggle('sel', n === sel);
    e.classList.toggle('col', n.col && n.c.length > 0);
    e.classList.toggle('root', isRoot(n));
    if (k) {
      e.style.borderColor = k;
      e.style.background = `color-mix(in srgb, ${k} 16%, #1b1e24)`;
    } else {
      const r = n.color;
      e.style.borderColor = r || '';
      e.style.background = r ? `color-mix(in srgb, ${r} 30%, #1b1e24)` : '';
    }
    if (!n.col)
      for (const c of n.c) {
        const q = P.get(c),
          L = sideOf.get(c) === 'l',
          x1 = L ? p.x - 2 : p.x + e.offsetWidth + 2,
          y1 = p.y + p.h / 2,
          x2 = L ? q.x + els.get(c).offsetWidth + 2 : q.x - 2,
          y2 = q.y + q.h / 2,
          mx = (x1 + x2) / 2,
          w = p.d === 0 ? 2.4 : p.d === 1 ? 1.8 : 1.4;
        d += `<path d="M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="${colr.get(c) || '#4a5363'}" stroke-width="${w}" stroke-linecap="round" opacity=".75"/>`;
      }
  }
  svg.innerHTML = d;
}
function glide(colr) {
  cancelAnimationFrame(raf);
  const from = new Map();
  let moving = false;
  for (const [n, p] of pos) {
    const s = shown.get(n);
    from.set(n, s || p);
    if (s && (Math.abs(s.x - p.x) > 0.5 || Math.abs(s.y - p.y) > 0.5)) moving = true;
  }
  const keep = (P) => {
    shown.clear();
    for (const [n, p] of P) shown.set(n, { x: p.x, y: p.y });
  };
  if (!moving || editing || subjDrag || document.hidden) {
    paint(pos, colr);
    keep(pos);
    return;
  }
  paint(new Map([...pos].map(([n, p]) => [n, { ...p, ...from.get(n) }])), colr); // new elements start where the old ones were
  const t0 = performance.now();
  const step = (now) => {
    const u = Math.min(1, (now - t0) / 170),
      e = 1 - Math.pow(1 - u, 3),
      P = new Map();
    for (const [n, p] of pos) {
      const f = from.get(n);
      P.set(n, { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e, d: p.d, h: p.h });
    }
    paint(P, colr);
    keep(P);
    if (u < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
