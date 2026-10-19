// Desktop app only: the File System Access API shape (handles) backed by the Rust shell over IPC.
const NATIVE = !!(window.ipc && window.ipc.postMessage);
const nfsWait = new Map();
let nfsN = 0;
window.__nfs = (id, ok, v) => {
  const w = nfsWait.get(id);
  nfsWait.delete(id);
  if (w) ok ? w[0](v) : w[1](new DOMException(String(v), 'NotFoundError'));
};
const nfs = (op, a = {}) =>
  new Promise((res, rej) => {
    nfsWait.set(++nfsN, [res, rej]);
    window.ipc.postMessage(JSON.stringify({ ...a, id: nfsN, op }));
  });
const dom = (n) => new DOMException(n, n);
class NFile {
  constructor(p) {
    this.kind = 'file';
    this.p = p;
    this.name = p.split('/').pop();
  }
  async getFile() {
    const t = await nfs('read', { p: this.p });
    return { name: this.name, text: async () => t };
  }
  async createWritable() {
    const parts = [];
    return {
      write: async (d) => parts.push(typeof d === 'string' ? d : await d.text()),
      close: () => nfs('write', { p: this.p, t: parts.join('') }),
    };
  }
}
class NDir {
  constructor(p, name) {
    this.kind = 'directory';
    this.p = p;
    this.name = name || p.split('/').pop();
  }
  sub(n) {
    return this.p ? this.p + '/' + n : n;
  }
  async getDirectoryHandle(n, o) {
    const p = this.sub(n),
      k = await nfs('kind', { p });
    if (k === 'dir') return new NDir(p);
    if (k) throw dom('TypeMismatchError');
    if (!(o && o.create)) throw dom('NotFoundError');
    await nfs('mkdir', { p });
    return new NDir(p);
  }
  async getFileHandle(n, o) {
    const p = this.sub(n),
      k = await nfs('kind', { p });
    if (k === 'file') return new NFile(p);
    if (k) throw dom('TypeMismatchError');
    if (!(o && o.create)) throw dom('NotFoundError');
    await nfs('write', { p, t: '' });
    return new NFile(p);
  }
  async *entries() {
    for (const [n, dir] of await nfs('list', { p: this.p }))
      yield [n, dir ? new NDir(this.sub(n)) : new NFile(this.sub(n))];
  }
  removeEntry(n) {
    return nfs('rm', { p: this.sub(n) });
  }
  queryPermission() {
    return Promise.resolve('granted');
  }
  requestPermission() {
    return Promise.resolve('granted');
  }
}
const nativeRoot = async () => {
  const p = await nfs('root');
  return p ? new NDir('', p.split('/').pop()) : null;
};
if (NATIVE) {
  addEventListener('keydown', (e) => e.metaKey && e.key === 'r' && location.reload()); // pick up edited page files
  window.showDirectoryPicker = async () => {
    const p = await nfs('pick');
    if (!p) throw dom('AbortError');
    return new NDir('', p.split('/').pop());
  };
  window.showOpenFilePicker = async () => {
    const fs = await nfs('open');
    if (!fs.length) throw dom('AbortError');
    return fs.map((f) => ({ name: f.name, getFile: async () => ({ text: async () => f.text }) }));
  };
}
