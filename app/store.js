export const state = { me: null };
const bus = new EventTarget();
export const on = (name, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(name, h); return () => bus.removeEventListener(name, h); };
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
