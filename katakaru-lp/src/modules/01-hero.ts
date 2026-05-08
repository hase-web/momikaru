import { hero, env } from '../data/content';
import { gsap } from '../lib/gsap-setup';
import { trackCta, trackPhoneTap } from '../lib/analytics';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Visual main copy lives inside hero1.png; alt carries the text equivalent.
const heroAlt = `${hero.main} — 肩こり・首集中メニューかたかる`;

export function renderHero(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'hero';
  section.setAttribute('aria-label', hero.main);
  section.className = 'hero-section';

  section.innerHTML = `
    <div class="hero-image-area" data-hero="image">
      <img
        src="/images/hero1.png"
        alt="${escapeHtml(heroAlt)}"
        decoding="async"
        fetchpriority="high"
        onerror="this.style.display='none'"
      />
    </div>

    <div class="hero-content-area">
      <div class="hero-content-inner">
        <p class="subcopy" data-hero-item>${escapeHtml(hero.sub)}</p>

        <p class="lead" data-hero-item>${escapeHtml(hero.lead)}</p>

        <div class="price-area flex items-stretch gap-3" data-hero-item>
          <div class="price-pill relative flex-1 !p-5 ring-2 ring-hot-pink/40">
            <span class="badge-recommend absolute -top-3 -left-2 !px-3 !py-[3px] !text-[10px] shadow-md">${escapeHtml(hero.prices.primary.badge)}</span>
            <span class="font-display text-[10.5px] font-bold tracking-wider text-deep-blue/70">${escapeHtml(hero.prices.primary.duration)}</span>
            <span class="mt-2 font-display text-[22px] sm:text-[26px] font-black leading-none text-hot-pink">${escapeHtml(hero.prices.primary.price)}</span>
            <span class="mt-1.5 text-[10px] sm:text-[10.5px] font-medium text-dark-navy/70">${escapeHtml(hero.prices.primary.sub)}</span>
          </div>
          <div class="price-pill flex-1 !p-5 opacity-90">
            <span class="font-display text-[10px] font-bold tracking-wider text-deep-blue/60">${escapeHtml(hero.prices.secondary.duration)}</span>
            <span class="mt-2 font-display text-[18px] sm:text-[22px] font-bold leading-none text-deep-blue">${escapeHtml(hero.prices.secondary.price)}</span>
            <span class="mt-1.5 text-[9.5px] sm:text-[10px] text-dark-navy/65">${escapeHtml(hero.prices.secondary.sub)}</span>
          </div>
        </div>

        <div class="cta-area flex gap-4" data-hero-item>
          <a
            href="${env.bookingUrl30}"
            data-cta="hero-primary"
            target="_blank"
            rel="noopener"
            aria-label="${escapeHtml(hero.ctaPrimary)}"
            class="btn-primary flex-1 !min-h-[52px] !py-3 !px-4 !text-[15px]"
          >
            <span class="relative z-10">${escapeHtml(hero.ctaPrimary)}</span>
          </a>
          <a
            href="tel:${env.phone}"
            data-cta="hero-tel"
            aria-label="${escapeHtml(hero.ctaSecondary)}"
            class="btn-secondary !min-h-[52px] !w-[52px] !px-0 !py-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  `;

  return section;
}

export function initHero(section: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  section.querySelectorAll<HTMLAnchorElement>('a[data-cta="hero-primary"]').forEach((el) => {
    el.addEventListener('click', () =>
      trackCta('hero_primary', { plan: '30', position: 'hero' }),
    );
  });
  section.querySelectorAll<HTMLAnchorElement>('a[data-cta="hero-tel"]').forEach((el) => {
    el.addEventListener('click', () => {
      trackPhoneTap('hero');
      trackCta('hero_tel', { plan: 'tel', position: 'hero' });
    });
  });

  const image = section.querySelector('[data-hero="image"]');
  const items = section.querySelectorAll('[data-hero-item]');

  if (reduced) {
    if (image) (image as HTMLElement).style.opacity = '1';
    items.forEach((el) => ((el as HTMLElement).style.opacity = '1'));
    return;
  }

  if (image) gsap.set(image, { autoAlpha: 0 });
  if (items.length) gsap.set(items, { autoAlpha: 0, y: 12 });

  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  if (image) tl.to(image, { autoAlpha: 1, duration: 0.8 }, 0);
  if (items.length)
    tl.to(items, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.1 }, 0.35);
}
