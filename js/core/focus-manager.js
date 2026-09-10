let currentIndex = 0;
let focusables = [];

export function refreshFocusables(container = document) {
  focusables = Array.from(container.querySelectorAll('[data-focusable]'));
  if (focusables.length) {
    currentIndex = 0;
    focusFirst();
  }
}

export function focusFirst() {
  currentIndex = 0;
  focusables[0]?.focus();
}

export function moveFocus(direction) {
  if (!focusables.length) return;

  const current = focusables[currentIndex] || focusables[0];
  const currentRect = current.getBoundingClientRect();

  let best = null;
  let bestDist = Infinity;

  focusables.forEach((el, i) => {
    if (el === current || !isVisible(el)) return;
    const rect = el.getBoundingClientRect();
    const dx = rect.left - currentRect.left;
    const dy = rect.top - currentRect.top;

    const matchesDirection =
      (direction === 'right' && dx > 4) ||
      (direction === 'left' && dx < -4) ||
      (direction === 'down' && dy > 4) ||
      (direction === 'up' && dy < -4);

    if (matchesDirection) {
      // Prioriza cercanía en la dirección principal, penaliza desvío lateral
      const primary = ['left', 'right'].includes(direction) ? Math.abs(dx) : Math.abs(dy);
      const secondary = ['left', 'right'].includes(direction) ? Math.abs(dy) : Math.abs(dx);
      const dist = primary + secondary * 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
  });

  if (best !== null) {
    currentIndex = best;
    focusables[best].focus();
    focusables[best].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
