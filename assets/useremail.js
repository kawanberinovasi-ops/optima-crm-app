/* OPTIMA CRM · ganti email login (versi Supabase).
   - Pengguna: Edit Profil → Ganti email. Wajib kata sandi sekarang kalau punya kata sandi; email lama bisa tetap dipakai.
   - Super Admin: Akses & Audit → Pengguna → Email: ganti email login dan kelola email tambahan siapa pun.
   Aturan dan pemeriksaannya ada di database (supabase/migrations/20261126000009_user_email.sql). */
(() => {
  'use strict';
  if (!window.OptimaSupabase || !window.Api) return;

  const fail = (e, m) => (window.ApiBoot ? ApiBoot.fail(e, m) : toast('Gagal tersimpan', e.message, 'bad'));
  // Data pengguna dari server (email utama, email tambahan) disalin ke cache tampilan.
  const putUser = (data) => { const u = userById(data.id); if (u) Object.assign(u, { email: data.email, altEmails: data.altEmails || [], hasPassword: data.hasPassword }); return u; };
  const keepOldBox = (m) => '<label style="display:flex;gap:10px;align-items:flex-start;grid-column:1/-1;font-size:14px"><input type="checkbox" name="keepOld" value="1"' + ((m.val || {}).keepOld === false ? '' : ' checked') + ' style="margin-top:3px"><span>Email lama tetap bisa dipakai untuk login (disarankan, supaya tidak terkunci keluar kalau ada salah ketik)</span></label>';

  /* ---------- pengguna: ganti email sendiri ---------- */
  Modals.myemail = (m) => {
    const u = me() || {};
    const v = m.val || {};
    const body = '<p style="margin:0;color:var(--ink2)">Email login sekarang: <b>' + esc(u.email) + '</b>. Email baru dipakai untuk masuk lewat Google maupun kata sandi. Super Admin mendapat pemberitahuan setiap email login diganti.</p>' +
      '<div class="form-grid"><label class="fld" style="grid-column:1/-1"><span>Email baru *</span><input class="inp" type="email" name="email" autocomplete="email" value="' + esc(v.email || '') + '"' + inv(m, 'email') + ' autofocus placeholder="nama@optima.web.id">' + fieldErr(m, 'email') + '</label>' +
      (u.hasPassword ? '<label class="fld" style="grid-column:1/-1"><span>Kata sandi sekarang *</span><input class="inp" type="password" name="password" autocomplete="current-password"' + inv(m, 'password') + '>' + fieldErr(m, 'password') + '</label>' : '') +
      keepOldBox(m) + '</div>' +
      '<p class="small muted" style="margin:0">Pastikan email baru benar-benar milikmu. Kalau masuk lewat Google, email baru harus akun Google; kalau bukan, pakai login kata sandi.</p>';
    return modalShell('Ganti email login', 'Profil saya', body,
      '<button type="button" class="btn btn-s" data-a="close">Batal</button><button type="submit" class="btn"' + (m.busy ? ' aria-busy="true"' : '') + '>' + ic('check', 'ic-s') + 'Simpan email</button>', false, 'myemail');
  };
  Actions.myemail = () => { App.pop = null; App.modal = { kind: 'myemail' }; render(); };
  Forms.myemail = async (o) => {
    const m = App.modal; if (m.busy) return;
    m.val = { email: o.email, keepOld: o.keepOld === '1' };
    const err = {};
    if (!o.email || !emailOk(o.email)) err.email = 'Format email belum benar.';
    if (me().hasPassword && !o.password) err.password = 'Isi kata sandi sekarang.';
    if (Object.keys(err).length) { m.err = err; m.still = true; render(); return; }
    m.busy = true; render();
    try {
      const res = await Api.post('me/email', { email: o.email.trim(), password: o.password || '', keepOld: o.keepOld === '1' });
      putUser(res.data); App.modal = null; render();
      toast('Email login diganti', 'Sekarang masuk pakai ' + res.data.email + '.');
    } catch (e) { m.busy = false; fail(e, m); }
  };

  /* ---------- Super Admin: email login dan email tambahan pengguna ---------- */
  Modals.useremail = (m) => {
    const u = userById(m.id) || {};
    const v = m.val || {};
    const alts = u.altEmails || [];
    const body = '<p style="margin:0;color:var(--ink2)">Semua email di bawah bisa dipakai <b>' + esc(u.name) + '</b> untuk masuk, lewat Google maupun kata sandi.</p>' +
      '<div class="form-grid"><label class="fld" style="grid-column:1/-1"><span>Email login (utama) *</span><input class="inp" type="email" name="email" value="' + esc(v.email != null ? v.email : u.email) + '"' + inv(m, 'email') + '>' + fieldErr(m, 'email') + '</label>' +
      keepOldBox(m) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><span class="lbl">Email tambahan</span>' +
      (alts.length ? alts.map(e => '<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--bg);border-radius:10px;padding:8px 12px"><span>' + esc(e) + '</span><button type="button" class="btn btn-s btn-sm" style="color:var(--bad)" data-a="altdel" data-v="' + esc(u.id) + '" data-e="' + esc(e) + '">Hapus</button></div>').join('') : '<span class="small muted">Belum ada email tambahan.</span>') +
      '<div style="display:flex;gap:8px;align-items:flex-start"><label class="fld" style="flex:1;margin:0"><span class="sr">Email tambahan baru</span><input class="inp" type="email" id="alt-email-new" placeholder="Contoh: nama@gmail.com"' + inv(m, 'alt') + '>' + fieldErr(m, 'alt') + '</label><button type="button" class="btn btn-s" data-a="altadd" data-v="' + esc(u.id) + '">Tambah</button></div></div>';
    return modalShell('Email ' + esc(u.name), 'Akses & Audit', body,
      '<button type="button" class="btn btn-s" data-a="close">Tutup</button><button type="submit" class="btn">' + ic('check', 'ic-s') + 'Simpan email login</button>', false, 'useremail');
  };
  Actions.useremail = (el) => { App.modal = { kind: 'useremail', id: el.dataset.v }; render(); };
  Forms.useremail = async (o) => {
    const m = App.modal; const u = userById(m.id);
    m.val = { email: o.email, keepOld: o.keepOld === '1' };
    if (!o.email || !emailOk(o.email)) { m.err = { email: 'Format email belum benar.' }; m.still = true; render(); return; }
    if (o.email.trim().toLowerCase() === u.email) { App.modal = null; render(); return; }
    try {
      const res = await Api.req('PUT', 'users/' + u.id + '/email', { email: o.email.trim(), keepOld: o.keepOld === '1' });
      putUser(res.data); App.modal = null; render();
      toast('Email login diganti', u.name + ' sekarang masuk pakai ' + res.data.email + '.');
    } catch (e) { fail(e, m); }
  };
  Actions.altadd = async (el) => {
    const m = App.modal; const input = document.getElementById('alt-email-new'); const e = (input && input.value || '').trim();
    if (!emailOk(e)) { m.err = { alt: 'Format email belum benar.' }; m.still = true; render(); return; }
    try { putUser((await Api.post('users/' + el.dataset.v + '/emails', { email: e })).data); m.err = {}; m.val = {}; m.still = true; render(); toast('Email tambahan disimpan', e + ' bisa dipakai untuk login.', 'info'); }
    catch (x) { if (x.status === 422) { m.err = { alt: (x.data.errors && x.data.errors.email && x.data.errors.email[0]) || x.message }; m.still = true; render(); } else fail(x); }
  };
  Actions.altdel = async (el) => {
    const m = App.modal;
    try { putUser((await Api.req('DELETE', 'users/' + el.dataset.v + '/emails', { email: el.dataset.e })).data); m.still = true; render(); toast('Email tambahan dihapus', el.dataset.e + ' tidak bisa dipakai login lagi.', 'info'); }
    catch (x) { fail(x); }
  };
})();
