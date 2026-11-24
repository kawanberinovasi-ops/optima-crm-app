/* OPTIMA CRM · klien Supabase kecil tanpa library: login Google (OAuth PKCE) dan panggilan ke fungsi public.api.
   Token disimpan di sessionStorage (hilang saat tab ditutup). Data CRM tidak pernah disimpan di browser. */
(() => {
  'use strict';
  const cfg = window.OPTIMA_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) return;
  const URL_ = cfg.url.replace(/\/+$/, '');
  const KEY = 'optima_sb_session', PKCE = 'optima_sb_pkce';
  const base = { apikey: cfg.anonKey };

  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage tidak tersedia */ } }
  };
  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const here = () => location.origin + location.pathname;

  let session = ss.get(KEY);
  const keep = (s) => {
    session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) } : null;
    ss.set(KEY, session);
  };

  async function auth(path, body, token) {
    const res = await fetch(URL_ + '/auth/v1/' + path, {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, base, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {})
    });
    let data = null; try { data = await res.json(); } catch (e) { /* kosong */ }
    if (!res.ok) { const err = new Error((data && (data.error_description || data.msg || data.message)) || 'Login gagal'); err.status = res.status; throw err; }
    return data;
  }

  // Satu refresh untuk semua permintaan yang menunggu.
  let refreshing = null;
  async function token() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    if (!refreshing) {
      refreshing = auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(keep).catch(() => keep(null)).finally(() => { refreshing = null; });
    }
    await refreshing;
    return session && session.access_token;
  }

  window.OptimaSupabase = {
    configured: true,
    hasSession: () => !!session,

    /** Ke halaman login Google lewat Supabase Auth, lalu kembali ke halaman ini dengan ?code=... */
    async signIn() {
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      ss.set(PKCE, verifier);
      location.href = URL_ + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(here())
        + '&code_challenge=' + challenge + '&code_challenge_method=s256';
    },

    /** Dipanggil saat halaman dibuka: tukar ?code= dari Google jadi sesi. Hasil: {signedIn} atau {error}. */
    async handleRedirect() {
      const q = new URLSearchParams(location.search);
      const h = new URLSearchParams(location.hash.replace(/^#\/?[^?]*\??/, ''));
      const code = q.get('code');
      const error = q.get('error') || h.get('error');
      if (!code && !error) return {};
      history.replaceState(null, '', here() + (location.hash.startsWith('#/') ? location.hash.split('?')[0] : ''));
      if (error) return { error: q.get('error_description') || h.get('error_description') || error };
      const verifier = ss.get(PKCE); ss.set(PKCE, null);
      if (!verifier) return { error: 'Sesi login kedaluwarsa. Coba sekali lagi.' };
      try { keep(await auth('token?grant_type=pkce', { auth_code: code, code_verifier: verifier })); return { signedIn: true }; }
      catch (e) { return { error: e.message }; }
    },

    /** Panggil public.api(method, path, body). Hasil: {status, data} seperti respons HTTP backend lama. */
    async call(method, path, body) {
      const t = await token();
      if (!t) return { status: 401, data: { message: 'Silakan masuk dulu.', code: 'unauthenticated' } };
      const res = await fetch(URL_ + '/rest/v1/rpc/api', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + t }, base),
        body: JSON.stringify({ method, path, body: body || {} })
      });
      if (res.status === 401) { keep(null); return { status: 401, data: { message: 'Sesi berakhir. Silakan masuk lagi.', code: 'unauthenticated' } }; }
      let r = null; try { r = await res.json(); } catch (e) { /* kosong */ }
      if (!res.ok || !r || typeof r.status !== 'number') return { status: res.status >= 400 ? res.status : 500, data: { message: (r && r.message) || 'Galat server' } };
      return r;
    },

    async signOut() {
      const t = session && session.access_token;
      keep(null);
      if (t) { try { await auth('logout', {}, t); } catch (e) { /* tetap keluar di browser */ } }
    }
  };
})();
