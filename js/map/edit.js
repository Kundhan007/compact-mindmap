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
      {
        const sl = getSelection();
        if (sl.rangeCount) {
          const r = sl.getRangeAt(0);
          r.deleteContents();
          const atEnd = !(() => {
            const q = document.createRange();
            q.selectNodeContents(e);
            q.setStart(r.endContainer, r.endOffset);
            return q.toString();
          })();
          const tn = document.createTextNode(atEnd ? '\n\u200b' : '\n'); // zero-width char keeps a valid caret spot on the new last line
          r.insertNode(tn);
          r.setStart(tn, 1);
          r.collapse(true);
          sl.removeAllRanges();
          sl.addRange(r);
        }
        n.t = clean0(e.textContent);
        place();
      }
    } // new line inside the node
    else if (ev.key === 'Enter') {
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
    } else if (ev.key === 'Backspace' && !clean0(e.textContent) && n !== root && !n.c.length) {
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
  if (!n.t && n !== root && !n.c.length) {
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
  if (sel === root) n.side = side || assignSide(n);
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
  if (p === root) n.side = sd(sel);
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
  if (p === root) n.side = sd(sel);
  sel = n;
  build();
  edit(n);
  reveal();
}
function del() {
  const p = parentOf(sel);
  if (!p) {
    root.c = [];
    root.t = '';
    sel = root;
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
