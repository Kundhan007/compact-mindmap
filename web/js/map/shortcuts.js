// Keyboard input: navigation, shortcuts, copy / paste / duplicate.
const memo = new Map(); // parent -> child last visited (so Right returns where Left came from)
function nav(k) {
  const p = parentOf(sel),
    from = sel,
    wasCol = sel.col;
  if (k === 'Parent') {
    if (p) sel = p;
  } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
    // "away from the root" is Left on the left side, Right on the right side
    const toChild = isRoot(sel) || (k === 'ArrowLeft') === (sideOf.get(sel) === 'l');
    if (!toChild) {
      if (p) sel = p;
    } else if (sel.col) {
      sel.col = false;
      build();
    } else {
      const want = isRoot(sel) ? (k === 'ArrowLeft' ? 'l' : 'r') : null,
        cands = want ? sel.c.filter((c) => sd(c) === want) : sel.c;
      if (cands.length) {
        const m = memo.get(sel);
        sel = m && cands.includes(m) ? m : cands[0];
      }
    }
  } else {
    const me = pos.get(sel),
      dir = k === 'ArrowDown' ? 1 : -1,
      d = me.d,
      sm = (n) =>
        rootOf(n) === rootOf(sel) && (isRoot(sel) || sideOf.get(n) === sideOf.get(sel));
    const same = [...pos]
      .filter(([n, q]) => q.d === d && sm(n))
      .sort((a, b) => a[1].y - b[1].y)
      .map((a) => a[0]);
    const j = same.indexOf(sel) + dir;
    if (same[j]) sel = same[j];
    else {
      let best = null,
        bs = 1e9;
      for (const [n, q] of pos) {
        if (!sm(n)) continue;
        const dy = (q.y - me.y) * dir;
        if (dy <= 0) continue;
        const s2 = dy * 1000 + Math.abs(q.d - d);
        if (s2 < bs) {
          bs = s2;
          best = n;
        }
      }
      if (best) sel = best;
    }
  }
  if (sel === from && sel.col === wasCol) hopSubject(k);
  const pp = parentOf(sel);
  if (pp) memo.set(pp, sel);
  select(sel);
}
addEventListener('keydown', (ev) => {
  if (editing) return;
  const k = ev.key;
  if ((ev.metaKey || ev.ctrlKey) && k.toLowerCase() === 'b') {
    ev.preventDefault();
    document.body.classList.toggle('nosb');
    return;
  }
  if (!loaded || !cur || !root) return; // locked until a map is selected
  if (
    (ev.metaKey || ev.ctrlKey) &&
    (k.toLowerCase() === 'd' || (ev.shiftKey && k.toLowerCase() === 'c'))
  ) {
    ev.preventDefault();
    dup();
    return;
  }
  if (ev.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
    ev.preventDefault(); // send a top-level branch straight to the other side
    if (isRoot(parentOf(sel))) {
      sel.side = k === 'ArrowLeft' ? 'l' : 'r';
      build();
      reveal();
    }
    return;
  }
  if (ev.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
    ev.preventDefault(); // reorder among siblings (same side for top-level branches)
    const p = parentOf(sel);
    if (p) {
      const st = k === 'ArrowUp' ? -1 : 1,
        i = p.c.indexOf(sel);
      let j = i + st;
      if (isRoot(p)) while (j >= 0 && j < p.c.length && sd(p.c[j]) !== sd(sel)) j += st;
      if (j >= 0 && j < p.c.length) {
        [p.c[i], p.c[j]] = [p.c[j], p.c[i]];
        build();
        reveal();
      }
    }
    return;
  }
  if (ev.altKey && /^Digit[0-8]$/.test(ev.code)) {
    ev.preventDefault();
    const i = +ev.code[5];
    if (i) sel.color = PAL[i - 1];
    else delete sel.color;
    build();
    return;
  }
  if (k === 'Tab') {
    ev.preventDefault();
    ev.shiftKey ? nav('Parent') : child();
  } else if (k === 'Enter') {
    ev.preventDefault();
    // only Shift+Enter (or a double-click) edits; plain Enter adds a sibling
    if (ev.metaKey || ev.ctrlKey) subject();
    else if (ev.shiftKey) edit(sel, true);
    else sibling();
  } else if (k === 'Delete' || k === 'Backspace') {
    ev.preventDefault();
    del();
  } else if (k === ' ' || k === '-' || ((ev.metaKey || ev.ctrlKey) && k.toLowerCase() === 'm')) {
    ev.preventDefault();
    const n = hover || sel; // the hovered node first
    if (n.c.length) {
      n.col = !n.col;
      build();
    }
  } else if (k.startsWith('Arrow')) {
    ev.preventDefault();
    nav(k);
  } else if (k === '0' && !ev.metaKey && !ev.ctrlKey) {
    fit();
  } // letters are commands (f, t…)
});

const outline = (n, d = 0) =>
  '\t'.repeat(d) + n.t.replace(/\n/g, ' ') + '\n' + n.c.map((c) => outline(c, d + 1)).join('');
const strip = (n) => ({ t: n.t, col: n.col, color: n.color, c: n.c.map(strip) });
const graft = (o) => ({
  id: uid++,
  t: o.t,
  col: !!o.col,
  ...(o.color ? { color: o.color } : {}),
  c: (o.c || []).map(graft),
});
function parseOutline(text) {
  // tab / 2-space indented lines (optionally with -, *, 1. bullets) -> nodes
  const roots = [],
    stack = [];
  for (const l of text.replace(/\r/g, '').split('\n')) {
    if (!l.trim()) continue;
    const m = l.match(/^(\s*)(.*)$/);
    const ind = m[1].replace(/ {2}/g, '\t').replace(/ /g, '').length;
    const t = m[2].replace(/^([-*•]|\d+[.)])\s+/, '').trim();
    if (!t) continue;
    const node = { id: uid++, t, c: [], col: false };
    while (stack.length && stack[stack.length - 1].d >= ind) stack.pop();
    (stack.length ? stack[stack.length - 1].n.c : roots).push(node);
    stack.push({ n: node, d: ind });
  }
  return roots;
}
document.addEventListener('copy', (e) => {
  if (editing || !loaded || !root) return; // while typing, native text copy applies
  const t = outline(sel);
  e.clipboardData.setData('text/plain', t);
  e.preventDefault();
  localStorage.mmClip = JSON.stringify({ text: t, node: strip(sel) });
  status('copied "' + (sel.t || '…') + '" with its sub-nodes');
});
document.addEventListener('paste', (e) => {
  if (editing || !loaded || !root) return;
  e.preventDefault();
  const t = e.clipboardData.getData('text/plain');
  let nodes = null;
  try {
    const c = JSON.parse(localStorage.mmClip);
    if (c.text === t) nodes = [graft(c.node)];
  } catch {} // our own copy: exact incl. colours/folds
  if (!nodes) nodes = parseOutline(t);
  if (!nodes.length) return;
  sel.col = false;
  for (const x of nodes) {
    sel.c.push(x);
    if (isRoot(sel)) x.side = assignSide(x);
  }
  sel = nodes[0];
  build();
  reveal();
});
function dup() {
  const p = parentOf(sel);
  if (!p) return;
  const o = graft(strip(sel));
  p.c.splice(p.c.indexOf(sel) + 1, 0, o);
  if (isRoot(p)) o.side = sd(sel);
  sel = o;
  build();
  reveal();
}
