// Remembers UI state across refreshes: selected node per map, sidebar visibility, open history panel.
if (localStorage.mmNosb) document.body.classList.add('nosb');
new MutationObserver(() => {
  localStorage.mmNosb = document.body.classList.contains('nosb') ? '1' : '';
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
new MutationObserver(() => {
  localStorage.mmHist = $('#hist').style.display === 'none' ? '' : '1';
}).observe($('#hist'), { attributes: true, attributeFilter: ['style'] });
function rememberSel() {
  if (cur && sel) localStorage['mmSel:' + kp(cur)] = sel.id;
}
function restoreUI(id) {
  const n = roots()
    .map((r) =>
      (function f(x) {
        return x.id === id ? x : x.c.map(f).find(Boolean);
      })(r),
    )
    .find(Boolean);
  if (n) {
    sel = n;
    place();
  }
  if (localStorage.mmHist) openHistory();
}
