const KEY = 'comunic-theme';
export const getTheme = () => localStorage.getItem(KEY) || 'dark';
export function applyTheme() {
  const t = getTheme(), dark = t === 'dark' || (t === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#120b07' : '#fbf3ea';
}
export function setTheme(v) { localStorage.setItem(KEY, v); applyTheme(); }
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (getTheme() === 'auto') applyTheme(); });
