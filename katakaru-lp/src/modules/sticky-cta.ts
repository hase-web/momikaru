import { stickyCta, env } from '../data/content';
import { gsap } from '../lib/gsap-setup';
import { trackCta, trackPhoneTap } from '../lib/analytics';

export function renderStickyCta(): HTMLElement {
  const root = document.getElementById('sticky-cta-root');
  if (!root) throw new Error('sticky-cta-root mount missing');

  root.innerHTML = `
    <div
      id="sticky-cta"
      role="region"
      aria-label="予約・電話のクイックアクセス"
      class="fixed inset-x-0 bottom-0 z-40 flex gap-2 px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] bg-white/85 backdrop-blur-lg border-t border-deep-blue/10 lg:hidden"
      style="opacity:0;transform:translateY(110%);pointer-events:none;"
    >
      <a
        href="tel:${env.phone}"
        data-cta="sticky-tel"
        aria-label="電話で予約する"
        class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-deep-blue text-deep-blue font-bold text-[13px] py-3 active:scale-[0.97] transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>
        </svg>
        ${stickyCta.call}
      </a>

      <a
        href="${env.bookingUrl30}"
        data-cta="sticky-30"
        target="_blank"
        rel="noopener"
        aria-label="WEBから予約する(Andy予約システム)"
        class="relative flex-[1.4] inline-flex items-center justify-center gap-1.5 rounded-full bg-hot-pink text-white font-bold text-[14px] py-3 shadow-cta active:scale-[0.97] transition overflow-hidden"
      >
        <span class="relative z-10">${stickyCta.book}</span>
        <span class="absolute inset-0 z-0" style="background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.45) 50%,transparent 70%);background-size:200% 100%;animation:cta-shimmer 3.4s linear infinite"></span>
      </a>
    </div>
  `;

  const bar = root.querySelector<HTMLElement>('#sticky-cta')!;
  return bar;
}

export function initStickyCta(bar: HTMLElement): void {
  bar.querySelector<HTMLAnchorElement>('a[data-cta="sticky-tel"]')?.addEventListener(
    'click',
    () => {
      trackPhoneTap('sticky');
      trackCta('sticky_tel', { plan: 'tel', position: 'sticky' });
    },
  );
  bar.querySelector<HTMLAnchorElement>('a[data-cta="sticky-30"]')?.addEventListener(
    'click',
    () => trackCta('sticky_30', { plan: '30', position: 'sticky' }),
  );

  let visible = false;
  const threshold = () => window.innerHeight * 0.5;

  const showBar = () => {
    if (visible) return;
    visible = true;
    bar.style.pointerEvents = 'auto';
    bar.removeAttribute('aria-hidden');
    gsap.to(bar, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
  };
  const hideBar = () => {
    if (!visible) return;
    visible = false;
    bar.setAttribute('aria-hidden', 'true');
    gsap.to(bar, {
      opacity: 0,
      y: '110%',
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => (bar.style.pointerEvents = 'none'),
    });
  };

  // Force initial transform via GSAP set so the inline style style.transform aligns.
  gsap.set(bar, { y: '110%', opacity: 0 });

  const onScroll = () => {
    if (window.scrollY > threshold()) showBar();
    else hideBar();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
