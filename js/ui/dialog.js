// In-page dialogs: the desktop webview ignores alert / confirm / prompt.
function dialog(msg, o) {
  return new Promise((res) => {
    const d = document.createElement('div');
    d.id = 'dlg';
    d.innerHTML = '<div><p></p><input><span><button></button><button></button></span></div>';
    d.querySelector('p').textContent = msg;
    const inp = d.querySelector('input'),
      [no, yes] = d.querySelectorAll('button');
    inp.hidden = !o.input;
    inp.value = o.def || '';
    no.hidden = o.single;
    no.textContent = 'Cancel';
    yes.textContent = 'OK';
    const done = (v) => {
      d.remove();
      res(v);
    };
    const ok = () => done(o.input ? inp.value : true),
      cancel = () => done(o.input ? null : o.single || false);
    yes.onclick = ok;
    no.onclick = cancel;
    d.onmousedown = (e) => e.target === d && cancel();
    d.onkeydown = (e) => {
      e.stopPropagation(); // keep map shortcuts out of the dialog
      if (e.key === 'Enter') ok();
      else if (e.key === 'Escape') cancel();
      else return;
      e.preventDefault();
    };
    document.body.appendChild(d);
    (o.input ? inp : yes).focus();
    if (o.input) inp.select();
  });
}
async function ask(msg, def) {
  return dialog(msg, { input: true, def });
}
async function okay(msg) {
  return dialog(msg, {});
}
async function tell(msg) {
  return dialog(msg, { single: true });
}
