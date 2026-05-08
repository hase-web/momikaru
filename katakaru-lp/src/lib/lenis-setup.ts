import Lenis from 'lenis';

let lenisInstance: Lenis | null = null;

export function initLenis(): Lenis {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: !reduced,
    syncTouch: false,
    touchMultiplier: 1.4,
  });

  function raf(time: number) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  lenisInstance = lenis;
  return lenis;
}

export function getLenis(): Lenis | null {
  return lenisInstance;
}
