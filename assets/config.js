/* OPTIMA CRM · sambungan ke Supabase.
   Isi url dan anonKey dari Supabase → Project Settings → API (anon key memang boleh publik: semua data dijaga
   fungsi api() di database, bukan oleh kunci ini). Kosongkan keduanya untuk mode demo (data contoh di browser). */
window.OPTIMA_SUPABASE = {
  url: 'https://uxquxzyjqqjrdksfhumn.supabase.co',
  anonKey: 'sb_publishable_c9e_Ye2QkRwkE0wZR3XsSQ_-3gPekJs'
};
if (window.OPTIMA_SUPABASE.url && window.OPTIMA_SUPABASE.anonKey) window.OPTIMA_API = 'supabase';
