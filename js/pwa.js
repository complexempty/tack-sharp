const RELOAD_FLAG = 'tacksharp.reloaded';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    let already = false;
    try {
      already = sessionStorage.getItem(RELOAD_FLAG) === '1';
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch (error) {
      already = false;
    }
    if (!already) window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  });
}
