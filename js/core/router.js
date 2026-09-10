const routes = new Map();
let notFoundHandler = () => {};

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function setNotFound(handler) {
  notFoundHandler = handler;
}

function resolve() {
  const hash = location.hash.replace('#', '') || '/login';
  const [path, param] = hash.split('/').filter(Boolean).reduce(
    (acc, part, i, arr) => (i === 0 ? [`/${part}`, arr[1]] : acc),
    ['/', undefined]
  );

  const handler = routes.get(path);
  handler ? handler(param) : notFoundHandler();
}

export function initRouter() {
  window.addEventListener('hashchange', resolve);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', resolve, { once: true });
  } else {
    resolve();
  }
}

export function navigate(path) {
  location.hash = path;
}