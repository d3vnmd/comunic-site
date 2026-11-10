// Hash router: #/chats, #/c/<slug> ... Back товч болон түүх зөв ажиллана
const routes = [];
let depth = 0;
export function route(pattern, fn) {
  const keys = (pattern.match(/:\w+/g) || []).map((k) => k.slice(1));
  routes.push({ re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), keys, fn });
}
export const here = () => decodeURIComponent((location.hash || '').slice(1)) || '/chats';
export function go(path, opts = {}) {
  const url = '#' + path;
  if (opts.replace) history.replaceState({ n: depth }, '', url);
  else { depth += 1; history.pushState({ n: depth }, '', url); }
  run();
}
export function back(fallback = '/chats') {
  if (depth > 0) history.back(); else go(fallback, { replace: true });
}
export function run() {
  const path = here();
  for (const r of routes) {
    const m = path.match(r.re); if (!m) continue;
    const params = {}; r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    r.fn(params, path); return;
  }
  go('/chats', { replace: true });
}
export function start() {
  const s = history.state; depth = (s && s.n) || 0;
  window.addEventListener('popstate', (e) => { depth = (e.state && e.state.n) || 0; run(); });
  run();
}
