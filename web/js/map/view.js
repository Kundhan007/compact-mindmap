// Viewport: transform, keeping the selection visible, selecting, fit to window.
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
  if (n.tm && n.tm.fired) n.tm.seen = true; // a finished timer stops blinking once looked at
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
