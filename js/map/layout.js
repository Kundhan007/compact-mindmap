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
  // branch colours: each top-level branch gets a palette colour, inherited down; node.color overrides (Alt+1..8)
  const colr = new Map();
  const cc = (n, inh, top) =>
    n.c.forEach((c, i) => {
      const k = c.color || (top ? PAL[i % PAL.length] : inh);
      colr.set(c, k);
      cc(c, k, false);
    });
  roots().forEach((R) => cc(R, null, true));
  lastColr = colr;
  let d = '';
  for (const [n, p] of pos) {
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
        const q = pos.get(c),
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
  rememberSel();
  save();
}
