/* OPTIMA CRM · kata sandi (versi Supabase): ganti kata sandi sendiri, dan Super Admin mengatur kata sandi sementara.
   Aturan dan penyimpanannya (hash bcrypt) ada di database, lihat supabase/migrations/20261124000008_password.sql. */
(() => {
  'use strict';
  if (!window.OptimaSupabase || !window.Api) return;

  const pwField = (m, name, label, extra) => '<label class="fld" style="grid-column:1/-1"><span>' + label + '</span><input class="inp" type="password" name="' + name + '"' + inv(m, name) + (extra || '') + '>' + fieldErr(m, name) + '</label>';
  // Kata sandi sementara acak yang mudah dibacakan: tanpa huruf/angka yang mirip (0/O, 1/l/I).
  const tempPassword = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const r = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(r, x => a[x % a.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
  };

  /* ---------- ganti kata sandi sendiri ---------- */
  Modals.pwchange = (m) => {
    const u = me() || {};
    const needCurrent = u.hasPassword && !m.forced;
    const body = (m.forced
      ? '<p style="margin:0;color:var(--ink2)">Kamu masuk dengan kata sandi sementara dari Super Admin. Buat kata sandi baru dulu sebelum lanjut.</p>'
      : '<p style="margin:0;color:var(--ink2)">' + (u.hasPassword ? 'Setelah diganti, sesi kata sandi di perangkat lain ikut keluar.' : 'Kata sandi ini bisa dipakai untuk masuk tanpa akun Google, dengan email ' + esc(u.email) + '.') + '</p>') +
      '<div class="form-grid">' +
      (needCurrent ? pwField(m, 'current', 'Kata sandi sekarang *', ' autocomplete="current-password" autofocus') : '') +
      pwField(m, 'password', 'Kata sandi baru *', ' autocomplete="new-password"' + (needCurrent ? '' : ' autofocus') + ' minlength="8"') +
      pwField(m, 'confirm', 'Ulangi kata sandi baru *', ' autocomplete="new-password"') +
      '</div><p class="small muted" style="margin:0">Minimal 8 karakter. Jangan dikirim ke siapa pun, termasuk admin.</p>';
    let html = modalShell(m.forced ? 'Ganti kata sandi sementara' : (u.hasPassword ? 'Ganti kata sandi' : 'Buat kata sandi'), 'Kata sandi', body,
      (m.forced ? '<button type="button" class="btn btn-s" data-a="logout">Keluar</button>' : '<button type="button" class="btn btn-s" data-a="close">Batal</button>') +
      '<button type="submit" class="btn"' + (m.busy ? ' aria-busy="true"' : '') + '>' + ic('check', 'ic-s') + 'Simpan</button>', false, 'pwchange');
    // Wajib ganti: tidak bisa ditutup.
    if (m.forced) html = html.replace(/<button type="button" class="icb" data-a="close"[^>]*>[\s\S]*?<\/button>/, '');
    return html;
  };
  Actions.pwchange = () => { App.pop = null; App.modal = { kind: 'pwchange' }; render(); };
  Forms.pwchange = async (o) => {
    const m = App.modal; if (m.busy) return;
    const err = {};
    if (!o.password || o.password.length < 8) err.password = 'Kata sandi minimal 8 karakter.';
    else if (o.password !== o.confirm) err.confirm = 'Ulangi kata sandi yang sama.';
    if (me().hasPassword && !m.forced && !o.current) err.current = 'Isi kata sandi sekarang.';
    if (Object.keys(err).length) { m.err = err; m.still = true; render(); return; }
    m.busy = true; render();
    try {
      const res = await Api.post('me/password', { current: o.current || '', password: o.password });
      Object.assign(me(), { hasPassword: res.data.hasPassword, mustChangePassword: false });
      const wasForced = m.forced;
      App.modal = null;
      if (wasForced) await ApiBoot.loadBootstrap();
      render(); toast('Kata sandi tersimpan', 'Pakai kata sandi baru ini saat login berikutnya.');
    } catch (e) { m.busy = false; ApiBoot.fail(e, m); }
  };

  // Modal wajib ganti tidak bisa ditutup lewat tombol atau klik di luar.
  ['close', 'scrim'].forEach(k => {
    const orig = Actions[k];
    if (orig) Actions[k] = (el, ev) => { if (App.modal && App.modal.forced) return; return orig(el, ev); };
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && App.modal && App.modal.forced) ev.stopImmediatePropagation(); }, true);

  /* ---------- Super Admin: kata sandi sementara untuk pengguna ---------- */
  Modals.userpw = (m) => {
    const u = userById(m.id) || {};
    const body = '<p style="margin:0;color:var(--ink2)">' + (u.hasPassword
        ? esc(u.name) + ' sudah punya kata sandi. Mengisi yang baru akan mengganti kata sandinya dan mengeluarkan sesi kata sandi lamanya.'
        : esc(u.name) + ' belum punya kata sandi. Setelah diatur, ' + esc(u.name) + ' bisa masuk dengan email ' + esc(u.email) + ' tanpa akun Google.') + '</p>' +
      '<div class="form-grid"><label class="fld" style="grid-column:1/-1"><span>Kata sandi sementara *</span><input class="inp" name="password" autocomplete="off" spellcheck="false" value="' + esc((m.val || {}).password || m.temp) + '"' + inv(m, 'password') + ' style="font-family:ui-monospace,Menlo,monospace">' + fieldErr(m, 'password') + '</label></div>' +
      '<p class="small muted" style="margin:0">Sampaikan langsung ke ' + esc(u.name) + ' (bukan di grup). Saat login pertama, ' + esc(u.name) + ' wajib menggantinya dengan kata sandi sendiri.</p>';
    return modalShell('Kata sandi ' + esc(u.name), 'Akses & Audit',
      body,
      (u.hasPassword ? '<button type="button" class="btn btn-s" style="color:var(--bad);margin-right:auto" data-a="userpwdel" data-v="' + esc(u.id) + '">Cabut login sandi</button>' : '') +
      '<button type="button" class="btn btn-s" data-a="close">Batal</button><button type="submit" class="btn">' + ic('check', 'ic-s') + 'Simpan</button>', false, 'userpw');
  };
  Actions.userpw = (el) => { App.modal = { kind: 'userpw', id: el.dataset.v, temp: tempPassword() }; render(); };
  Forms.userpw = async (o) => {
    const m = App.modal; m.val = o;
    if (!o.password || o.password.length < 8) { m.err = { password: 'Minimal 8 karakter.' }; m.still = true; render(); return; }
    try {
      const res = await Api.req('PUT', 'users/' + m.id + '/password', { password: o.password });
      const u = userById(m.id); Object.assign(u, { hasPassword: res.data.hasPassword, mustChangePassword: res.data.mustChangePassword });
      App.modal = null; render();
      toast('Kata sandi sementara disimpan', 'Sampaikan langsung ke ' + u.name + '. Wajib diganti saat login pertama.', 'info');
    } catch (e) { ApiBoot.fail(e, m); }
  };
  Actions.userpwdel = (el) => {
    const u = userById(el.dataset.v);
    App.modal = { kind: 'confirm', sub: 'Kata sandi', title: 'Cabut login kata sandi ' + esc(u.name) + '?', danger: true, ok: 'Cabut',
      text: esc(u.name) + ' tidak bisa lagi masuk dengan kata sandi, dan sesi kata sandinya langsung keluar. Login Google tetap bisa dipakai.',
      fn: () => { Api.del('users/' + u.id + '/password').then(res => { Object.assign(u, { hasPassword: res.data.hasPassword }); App.modal = null; render(); toast('Dicabut', u.name + ' sekarang hanya bisa masuk lewat Google.', 'info'); }).catch(e => ApiBoot.fail(e)); } };
    render();
  };
})();
