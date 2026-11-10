import { sb, errText } from './api.js';
import { h, clear, sheet, toast, copyText } from './ui.js';
import { icon, MARK } from './icons.js';

const logo = () => { const d = h('div', { class: 'core' }); d.innerHTML = MARK; return d; };

export function showAuth(root) {
  clear(root); root.className = 'auth';
  const err = h('p', { class: 'err', role: 'alert' });
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('busy', on); };
  const fail = (e) => { err.textContent = errText(e); };

  const discord = h('button', { class: 'btn pri wide', onclick: async (e) => {
    err.textContent = ''; busy(e.currentTarget, true);
    const { error } = await sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + '/app/' } });
    if (error) { fail(error); busy(discord, false); }
  } }, 'Discord-оор нэвтрэх');

  const gname = h('input', { class: 'inp', placeholder: 'Нэрээ бич', maxlength: '20', autocomplete: 'nickname', 'aria-label': 'Зочны нэр' });
  const guestBtn = h('button', { class: 'btn out wide', onclick: async () => {
    err.textContent = ''; const name = gname.value.trim();
    if (name.length < 2) { err.textContent = 'Нэр хамгийн багадаа 2 тэмдэгт байна.'; gname.focus(); return; }
    busy(guestBtn, true);
    try {
      const { data, error } = await sb.functions.invoke('guest', { body: { name } });
      if (error || !data || data.error) throw new Error((data && data.error) || (error && error.message) || 'guest');
      const { error: e2 } = await sb.auth.signInWithPassword({ email: `guest${data.n}@guest.comunic.online`, password: data.password });
      if (e2) throw e2;
      sheet((close) => h('div', { class: 'cf' },
        h('p', null, 'Таны Зочны ID болон нууц үгийг хадгалаарай. Дараа нь энэ мэдээллээр дахин нэвтэрнэ.'),
        h('div', { class: 'cred' }, h('span', null, 'ID'), h('b', null, String(data.n))),
        h('div', { class: 'cred' }, h('span', null, 'Нууц үг'), h('b', null, data.password)),
        h('div', { class: 'row' },
          h('button', { class: 'btn out', onclick: () => copyText(`ID: ${data.n}\nНууц үг: ${data.password}`) }, 'Хуулах'),
          h('button', { class: 'btn pri', onclick: close }, 'Хадгалсан')) ), { title: 'Зочин бүртгэл', noFocus: true });
    } catch (e) { fail(e); busy(guestBtn, false); }
  } }, 'Зочноор орох');

  const lid = h('input', { class: 'inp', placeholder: 'Хэрэглэгчийн нэр эсвэл Зочны ID', autocomplete: 'username', autocapitalize: 'none', 'aria-label': 'Нэр' });
  const lpw = h('input', { class: 'inp', type: 'password', placeholder: 'Нууц үг', autocomplete: 'current-password', 'aria-label': 'Нууц үг' });
  const loginBtn = h('button', { class: 'btn out wide', onclick: async () => {
    err.textContent = ''; if (!lid.value.trim() || !lpw.value) { err.textContent = 'Нэр болон нууц үгээ бичнэ үү.'; return; }
    busy(loginBtn, true);
    try {
      const { data, error } = await sb.functions.invoke('login', { body: { id: lid.value, password: lpw.value } });
      if (error || !data || data.error) throw new Error((data && data.error) || (error && error.message) || 'invalid');
      const { error: e2 } = await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (e2) throw e2;
    } catch (e) { fail(e); busy(loginBtn, false); }
  } }, 'Нэвтрэх');
  [lpw, lid].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); }));
  gname.addEventListener('keydown', (e) => { if (e.key === 'Enter') guestBtn.click(); });

  const pw = h('details', { class: 'pwbox' }, h('summary', null, 'Нууц үгээр нэвтрэх'), h('div', { class: 'stack' }, lid, lpw, loginBtn));
  root.append(h('div', { class: 'auth-in' },
    h('div', { class: 'orbit sm', 'aria-hidden': 'true' }, h('div', { class: 'rg' }), logo()),
    h('h1', null, 'Comunic-д тавтай морил'),
    h('p', { class: 'sub' }, 'Ярианы шинэ гэр. Нэвтэрч найзуудтайгаа холбогд.'),
    h('div', { class: 'stack' }, discord,
      h('div', { class: 'or' }, h('span', null, 'эсвэл')),
      gname, guestBtn),
    pw, err,
    h('p', { class: 'legal' }, 'Нэвтэрснээр та ', h('a', { href: '/terms.html', target: '_blank', rel: 'noopener' }, 'Үйлчилгээний нөхцөл'), ' болон ', h('a', { href: '/privacy.html', target: '_blank', rel: 'noopener' }, 'Нууцлалын бодлого'), '-ыг зөвшөөрнө.')));
  void icon; void toast;
}
