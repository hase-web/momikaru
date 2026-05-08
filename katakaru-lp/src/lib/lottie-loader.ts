import lottie, { type AnimationItem } from 'lottie-web';

type LoadOpts = {
  container: HTMLElement;
  path: string;
  loop?: boolean;
  autoplay?: boolean;
  renderer?: 'svg' | 'canvas';
};

export function loadLottie(opts: LoadOpts): AnimationItem {
  return lottie.loadAnimation({
    container: opts.container,
    path: opts.path,
    renderer: opts.renderer ?? 'svg',
    loop: opts.loop ?? true,
    autoplay: opts.autoplay ?? true,
  });
}

// Decorative feather drift in background. Falls back to CSS-only feathers
// if the JSON is missing (so the LP still works without bundled assets).
export function initFeatherLayer(rootId = 'feather-layer'): void {
  const root = document.getElementById(rootId);
  if (!root) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const featherCount = window.innerWidth < 768 ? 5 : 9;
  for (let i = 0; i < featherCount; i++) {
    const f = document.createElement('span');
    f.setAttribute('aria-hidden', 'true');
    f.className = 'absolute block';
    f.style.left = `${Math.random() * 100}%`;
    f.style.top = `${Math.random() * 100}%`;
    f.style.width = `${10 + Math.random() * 18}px`;
    f.style.height = f.style.width;
    f.style.borderRadius = '60% 40% 50% 50% / 60% 60% 40% 40%';
    f.style.background =
      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(245,194,214,0.55) 60%, rgba(74,144,226,0) 100%)';
    f.style.filter = 'blur(0.5px)';
    f.style.animation = `feather-drift ${8 + Math.random() * 6}s ease-in-out ${(-Math.random() * 6).toFixed(2)}s infinite`;
    f.style.opacity = `${0.45 + Math.random() * 0.4}`;
    root.appendChild(f);
  }
}
