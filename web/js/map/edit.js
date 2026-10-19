// Node editing: edit/finish, add child/sibling, delete.
const clean0 = (t) => t.replace(/\u200b/g, '');
function edit(n, atEnd) {
  editing = n;
  const e = els.get(n);
  e.contentEditable = 'plaintext-only';
  e.focus();
  const r = document.createRange();
  r.selectNodeContents(e);
  if (atEnd) r.collapse(false);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  e.oninput = () => {
    n.t = clean0(e.textContent);
    place();
  };
  e.onkeydown = (ev) => {
    if (ev.key === 'Enter' && ev.shiftKey) {
      ev.preventDefault();
      newline(n);
    } else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      finish();
      subject();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      finish();
      sibling();
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      finish();
      ev.shiftKey ? nav('Parent') : child();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      finish();
    } else if (ev.key === 'Backspace' && !clean0(e.textContent) && !isRoot(n) && !n.c.length) {
      // empty node: drop it, land on the previous node in reading order
      ev.preventDefault();
      editing = null;
      e.onblur = null;
      const p = parentOf(n),
        i = p.c.indexOf(n);
      p.c.splice(i, 1);
      let t = p.c[i - 1];
      while (t && !t.col && t.c.length) t = t.c[t.c.length - 1];
      sel = t || p;
      build();
      edit(sel, true);
      reveal();
    } else if (ev.key.startsWith('Arrow') && !ev.shiftKey && !ev.metaKey && !ev.altKey) {
      const s = getSelection(),
        len = e.textContent.length,
        c = s.isCollapsed;
      let pre = '';
      if (s.anchorNode) {
        const r = document.createRange();
        r.selectNodeContents(e);
        r.setEnd(s.anchorNode, s.anchorOffset);
        pre = r.toString();
      }
      const firstLine = !pre.includes('\n'),
        lastLine = !e.textContent.slice(pre.length).includes('\n'); // in multi-line text Up/Down move the caret first
      const go =
        (ev.key === 'ArrowUp' && firstLine) ||
        (ev.key === 'ArrowDown' && lastLine) ||
        (ev.key === 'ArrowLeft' && c && s.anchorOffset === 0) ||
        (ev.key === 'ArrowRight' && c && s.anchorOffset === len); // with text selected, Left/Right just collapse the selection
      if (go) {
        ev.preventDefault();
        finish();
        nav(ev.key);
      }
    }
    ev.stopPropagation();
  };
  e.onblur = () => {
    if (editing === n) finish();
  };
}
function newline(n) {
  const e = els.get(n),
    sl = getSelection();
  if (sl.rangeCount) {
    const r = sl.getRangeAt(0);
    r.deleteContents();
    const q = document.createRange();
    q.selectNodeContents(e);
    q.setStart(r.endContainer, r.endOffset);
    const tn = document.createTextNode(q.toString() ? '\n' : '\n​'); // zero-width char keeps a caret spot on a new last line
    r.insertNode(tn);
    r.setStart(tn, 1);
    r.collapse(true);
    sl.removeAllRanges();
    sl.addRange(r);
  }
  n.t = clean0(e.textContent);
  place();
}
function subject() {
  // a new separate root below everything; move it later with Cmd/Ctrl+drag
  let y = 0;
  for (const [n, p] of pos) y = Math.max(y, p.y + p.h);
  const n = mk();
  n.ox = 0;
  n.oy = y + 60;
  more.push(n);
  sel = n;
  build();
  edit(n);
  reveal();
}
function finish() {
  const n = editing;
  if (!n) return;
  editing = null;
  const e = els.get(n);
  if (e) {
    e.contentEditable = 'false';
    e.onblur = null;
    n.t = clean0(e.textContent).trim();
    e.textContent = n.t;
  }
  if (!n.t && !isRoot(n) && !n.c.length) {
    const p = parentOf(n);
    p.c.splice(p.c.indexOf(n), 1);
    sel = p;
    build();
  } else place(); // no rebuild: keeps the element under the mouse alive so the next click/double-click lands
}
function child(side) {
  if (sel.col) sel.col = false;
  const n = mk();
  sel.c.push(n);
  if (isRoot(sel)) n.side = side || assignSide(n);
  sel = n;
  build();
  edit(n);
  reveal();
}
function siblingBefore() {
  const p = parentOf(sel);
  if (!p) return child();
  const n = mk();
  p.c.splice(p.c.indexOf(sel), 0, n);
  if (isRoot(p)) n.side = sd(sel);
  sel = n;
  build();
  edit(n);
  reveal();
}
function sibling() {
  const p = parentOf(sel);
  if (!p) return child();
  const n = mk();
  p.c.splice(p.c.indexOf(sel) + 1, 0, n);
  if (isRoot(p)) n.side = sd(sel);
  sel = n;
  build();
  edit(n);
  reveal();
}
function del() {
  const p = parentOf(sel);
  if (!p) {
    if (sel !== root) {
      more.splice(more.indexOf(sel), 1);
      sel = root;
      build();
      reveal();
      return;
    }
    root.c = [];
    root.t = '';
    build();
    edit(root);
    return;
  }
  const i = p.c.indexOf(sel);
  p.c.splice(i, 1);
  sel = p.c[i] || p.c[i - 1] || p;
  build();
  reveal();
}
