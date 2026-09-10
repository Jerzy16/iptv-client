function detect() {
  const ua = navigator.userAgent.toLowerCase();
  if (typeof window.tizen !== 'undefined') return 'tizen';
  if (typeof window.webOS !== 'undefined' || ua.includes('web0s')) return 'webos';
  if (ua.includes('android') && ua.includes('tv')) return 'androidtv';
  return 'web';
}

export const PLATFORM = detect();
export const isTV = PLATFORM !== 'web';