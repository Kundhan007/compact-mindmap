// Rendering: DOM nodes, two-sided compact layout, connectors, colours, numbering, viewport.
function build() {
  for (const e of els.values()) e.remove();
  els.clear();
  (function w(n) {
    const e = document.createElement('div');
    e.className = 'n';
    e.textContent = n.t;
    let was = false; // click on an already-selected node edits it
    e.onmousedown = (ev) => {
      ev.stopPropagation();
      dragMoved = false;
      was = sel === n && !editing;
      select(n);
      if (editing !== n && n !== root && ev.button === 0)
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
  })(root);
  place();
}
function place() {
  hideDots();
  // numbering is display-only (data-num -> CSS ::before); node text is never modified
  const num = new Map();
  (function nn(n, pre) {
    n.c.forEach((c, i) => {
      const s = pre ? pre + '.' + (i + 1) : '' + (i + 1);
      num.set(c, s);
      nn(c, s);
    });
  })(root, '');
  for (const [n, e] of els) {
    if (numbered && num.has(n)) e.dataset.num = num.get(n);
    else delete e.dataset.num;
  }
  $('#bn').classList.toggle('on', numbered);
  pos.clear();
  sideOf.clear();
  // children sit right next to their parent; top-level branches split left/right by node.side
  const rootW = els.get(root).offsetWidth,
    groups = { r: [], l: [] };
  if (!root.col) for (const c of root.c) groups[sd(c)].push(c);
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
  {
    const rh = els.get(root).offsetHeight;
    pos.set(root, { x: 0, y: -rh / 2, d: 0, h: rh });
  }
  let minY = 0;
  for (const q of pos.values()) minY = Math.min(minY, q.y);
  for (const q of pos.values()) q.y -= minY;
  // branch colours: each top-level branch gets a palette colour, inherited down; node.color overrides (Alt+1..8)
  const colr = new Map();
  (function cc(n, inh, top) {
    n.c.forEach((c, i) => {
      const k = c.color || (top ? PAL[i % PAL.length] : inh);
      colr.set(c, k);
      cc(c, k, false);
    });
  })(root, null, true);
  lastColr = colr;
  let d = '';
  for (const [n, p] of pos) {
    const e = els.get(n),
      k = colr.get(n);
    e.style.left = p.x + 'px';
    e.style.top = p.y + 'px';
    e.classList.toggle('sel', n === sel);
    e.classList.toggle('col', n.col && n.c.length > 0);
    e.classList.toggle('root', n === root);
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
  save();
}
function apply() {
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  stage.style.backgroundSize = `${24 * view.k}px ${24 * view.k}px`;
  stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
}
function reveal() {
  const p = pos.get(sel),
    e = els.get(sel);
  if (!p) return;
  const W = stage.clientWidth,
    Hh = stage.clientHeight;
  const sx = p.x * view.k + view.x,
    sy = p.y * view.k + view.y,
    w = e.offsetWidth * view.k,
    h = p.h * view.k,
    m = 40;
  if (sx < m) view.x += m - sx;
  else if (sx + w > W - m) view.x -= sx + w - W + m;
  if (sy < m) view.y += m - sy;
  else if (sy + h > Hh - m) view.y -= sy + h - Hh + m;
  apply();
}
function select(n) {
  sel = n;
  place();
  reveal();
}
function fit() {
  if (!pos.size) return;
  let x0 = 1e9,
    x1 = -1e9,
    y1 = 0;
  for (const [n, p] of pos) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x + els.get(n).offsetWidth);
    y1 = Math.max(y1, p.y + p.h);
  }
  const W = x1 - x0;
  view.k = Math.min(1.5, (stage.clientWidth - 120) / W, (stage.clientHeight - 80) / y1);
  view.x = (stage.clientWidth - W * view.k) / 2 - x0 * view.k;
  view.y = (stage.clientHeight - y1 * view.k) / 2;
  apply();
  save();
}
