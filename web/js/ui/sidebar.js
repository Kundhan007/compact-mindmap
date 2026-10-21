// Sidebar file tree and the toolbar buttons.
function renderTree() {
  const t = $('#tree');
  t.innerHTML = '';
  const kids = (p) =>
    items
      .filter((i) => (i.parent || null) === p)
      .sort(
        (a, b) =>
          (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || a.name.localeCompare(b.name),
      );
  (function walk(p, d) {
    for (const i of kids(p)) {
      const e = document.createElement('div');
      e.className = 'it' + (i.id === cur ? ' cur' : '');
      e.style.paddingLeft = 6 + d * 12 + 'px';
      e.innerHTML = `<span class="ic">${i.type === 'folder' ? (openF.has(i.id) ? '▾' : '▸') : '·'}</span><span class="nm"></span><span class="x" title="move to .trash">×</span>`;
      e.querySelector('.nm').textContent = i.name;
      e.draggable = true;
      e.onclick = (ev) => {
        if (ev.target.className === 'x') return;
        if (i.type === 'folder') {
          selFolder = i.id;
          openF.has(i.id) ? openF.delete(i.id) : openF.add(i.id);
          localStorage.mmOpen = JSON.stringify([...openF]);
          renderTree();
        } else openMap(i.id);
      };
      e.ondblclick = () => rename(i);
      e.querySelector('.x').onclick = () => remove(i);
      e.ondragstart = (ev) => ev.dataTransfer.setData('text/plain', i.id);
      if (i.type === 'folder') {
        e.ondragover = (ev) => {
          ev.preventDefault();
          e.classList.add('drop');
        };
        e.ondragleave = () => e.classList.remove('drop');
        e.ondrop = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          move(ev.dataTransfer.getData('text/plain'), i.id);
        };
      }
      t.appendChild(e);
      if (i.type === 'folder' && openF.has(i.id)) walk(i.id, d + 1);
    }
  })(null, 0);
  t.ondragover = (ev) => ev.preventDefault();
  t.ondrop = (ev) => move(ev.dataTransfer.getData('text/plain'), null);
}
async function move(id, parent) {
  const it = items.find((i) => i.id === id);
  if (!it || id === parent || (it.parent || null) === parent) return;
  if (parent && (parent === id || parent.startsWith(id + '/'))) return; // no cycles
  if (parent) openF.add(parent);
  try {
    await moveEntry(it, parent || '');
  } catch (e) {
    await tell('Move failed: ' + e.message);
  }
}
async function rename(i) {
  if (i.type === 'folder') {
    await tell('Rename folders in Finder, then press ↻');
    return;
  }
  const n = clean((await ask('Rename', i.name)) || '');
  if (!n || n === i.name) return;
  try {
    await moveEntry(i, i.parent || '', n + EXT);
  } catch (e) {
    await tell('Rename failed: ' + e.message);
  }
}
async function remove(i) {
  if (
    !(await okay(
      `Move "${i.name}"${i.type === 'folder' ? ' and everything inside' : ''} to .trash?`,
    ))
  )
    return;
  try {
    await moveEntry(i, '.trash', Date.now() + '-' + split(i.id)[1]);
  } catch (e) {
    await tell('Delete failed: ' + e.message);
  }
}
async function newItem(type, name) {
  if (!rootH) return null;
  const nm = clean(
    name ||
      (await ask(
        type === 'folder' ? 'Folder name' : 'Map name',
        type === 'folder' ? 'New folder' : 'Untitled',
      )) ||
      '',
  );
  if (!nm) return null;
  const parent = selFolder && items.some((i) => i.id === selFolder) ? selFolder : '';
  const dir = await dirAt(parent, true);
  if (type === 'folder') {
    const n = await uniq(dir, nm);
    await dir.getDirectoryHandle(n, { create: true });
    if (parent) openF.add(parent);
    await rescan();
    return null;
  }
  const fn = await uniq(dir, nm + EXT),
    id = (parent ? parent + '/' : '') + fn;
  await writeText(id, 'null');
  if (parent) openF.add(parent);
  await rescan();
  await openMap(id);
  return id;
}
$('#bm').onclick = () => newItem('map');
$('#bf').onclick = () => newItem('folder');
$('#br').onclick = () => {
  if (rootH) {
    rescan();
    checkExternal();
  }
};
$('#bi').onclick = async () => {
  // copy .kundhan (or old .json) files from anywhere into the selected folder
  if (!rootH) return;
  let fhs;
  try {
    fhs = await showOpenFilePicker({
      multiple: true,
      types: [{ description: 'Mindmap', accept: { 'application/json': [EXT, '.json'] } }],
    });
  } catch {
    return;
  }
  const parent = selFolder && items.some((i) => i.id === selFolder) ? selFolder : '',
    dir = await dirAt(parent, true);
  for (const fh of fhs) {
    const txt = await (await fh.getFile()).text();
    try {
      if (!JSON.parse(txt).root) throw 0;
    } catch {
      await tell(fh.name + ': not a mindmap file');
      continue;
    }
    const fn = await uniq(dir, clean(fh.name.replace(/\.(kundhan|json)$/, '')) + EXT);
    await writeText((parent ? parent + '/' : '') + fn, txt);
  }
  if (parent) openF.add(parent);
  await rescan();
};

$('#bs').onclick = () => {
  if (!loaded || !cur || !root) return;
  finish();
  subject();
};
$('#bb').onclick = () => {
  // even out the two sides by leaf count; order inside each side is kept
  if (!loaded || !cur || !root) return;
  const leaves = (n) => (n.c.length && !n.col ? n.c.reduce((a, c) => a + leaves(c), 0) : 1);
  let R = 0,
    Lf = 0;
  for (const b of rootOf(sel).c) {
    const w = leaves(b);
    if (R <= Lf) {
      b.side = 'r';
      R += w;
    } else {
      b.side = 'l';
      Lf += w;
    }
  }
  build();
  fit();
};
$('#bn').onclick = () => {
  if (!loaded || !cur || !root) return;
  numbered = !numbered;
  place();
};
// toolbar dropdown: open on click, close after a choice, an outside click or Escape
$('#bmenu').onclick = (e) => {
  e.stopPropagation();
  $('#tools').classList.toggle('open');
};
$('#tmenu').onclick = () => $('#tools').classList.remove('open');
addEventListener('mousedown', (e) => !$('#tools').contains(e.target) && $('#tools').classList.remove('open'));
addEventListener('keydown', (e) => e.key === 'Escape' && $('#tools').classList.remove('open'));
