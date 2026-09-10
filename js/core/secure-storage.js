// Cifrado simétrico AES-GCM vía Web Crypto API.
// Nota honesta: esto evita texto plano visible en localStorage, pero no es
// irrompible si alguien tiene el código fuente (siempre lo tiene: es JS/HTML/CSS).
// La protección real del password es migrar a modo "proxy" (ver config.js).

const ENC = new TextEncoder();
const DEC = new TextDecoder();

async function getKey() {
  const material = await crypto.subtle.importKey(
    'raw',
    ENC.encode('cambia-este-secreto-por-uno-propio-de-tu-app'),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ENC.encode('iptv-salt-v1'), iterations: 100000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function setSecure(key, value) {
  const cryptoKey = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = ENC.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);

  const payload = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipher))
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

export async function getSecure(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const { iv, data } = JSON.parse(raw);
    const cryptoKey = await getKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      cryptoKey,
      new Uint8Array(data)
    );
    return JSON.parse(DEC.decode(plain));
  } catch {
    // Datos corruptos o de una versión anterior del cifrado: se descartan
    localStorage.removeItem(key);
    return null;
  }
}

export function removeSecure(key) {
  localStorage.removeItem(key);
}
