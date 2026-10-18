// Undo / redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) for tree edits, kept in memory per open map.
let undoFor = null,
  undoLast = null,
  undoKey = null,
  undos = [],
  redos = [];
const treeStr = () => JSON.stringify({ root, more });
function trackUndo() {
  const s = treeStr();
  if (undoFor !== cur) {
    undoFor = cur;
    undoLast = { s, sel: sel && sel.id };
    undos = [];
    redos = [];
    return;
  }
  if (s === undoLast.s) {
    undoLast.sel = sel && sel.id;
    return;
  }
  if (!editing || editing !== undoKey) {
    undos.push(undoLast); // typing inside one node is a single undo step
    if (undos.length > 200) undos.shift();
  }
  undoKey = editing;
  redos = [];
  undoLast = { s, sel: sel && sel.id };
}
function applyUndo(from, to, msg) {
  if (!from.length) return status('nothing to ' + msg);
  to.push({ s: treeStr(), sel: sel && sel.id });
  const e = from.pop(),
    d = JSON.parse(e.s);
  root = d.root;
  more = d.more || [];
  undoLast = { s: e.s, sel: e.sel };
  undoKey = null;
  sel =
    roots()
      .map((r) =>
        (function f(x) {
          return x.id === e.sel ? x : x.c.map(f).find(Boolean);
        })(r),
      )
      .find(Boolean) || root;
  build();
  reveal();
  status('↶ ' + msg + 'ne');
}
addEventListener('keydown', (ev) => {
  if (editing || !loaded || !root || !(ev.metaKey || ev.ctrlKey) || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'z' && !ev.shiftKey) applyUndo(undos, redos, 'undo');
  else if ((k === 'z' && ev.shiftKey) || k === 'y') applyUndo(redos, undos, 'redo');
  else return;
  ev.preventDefault();
});
